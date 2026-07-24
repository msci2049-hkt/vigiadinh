//! Recovery Registry v2 — guardian vote + timelock + veto, VÀ XOAY KHOÁ THẬT.
//!
//! Registry v1 (`CCPGVSLR…`, spike ngoài repo) sinh cho mô hình classic: finalize
//! chỉ đổi `owner` trong storage CỦA NÓ — smart account không hề biết, thiết bị
//! mới không ký được gì (audit P0 2026-07-24). v1 còn không CHỞ nổi vật liệu
//! passkey: `new_owner_candidate` là Address, passkey là `External(verifier, key)`.
//!
//! v2 giữ NGUYÊN semantics + tên hàm + error codes + event topics của v1 (BE
//! indexer/route đổi tối thiểu), khác đúng hai chỗ:
//!   1. `initiate_recovery` nhận `Signer` (OZ) — guardian bỏ phiếu cho ĐÚNG khoá mới.
//!   2. `finalize_recovery` gọi `recovery_rotate` trên smart account (invoker auth)
//!      — khoá đổi BÊN TRONG ví, địa chỉ ví không đổi, tiền không di chuyển.
//!
//! "wallet" = địa chỉ smart account (C…) tự đăng ký bằng `require_auth` (passkey ký
//! qua `__check_auth`). Veto = chính ví ký (`cancel_recovery`) — khoá còn sống nào
//! cũng chặn được. Registry KHÔNG giữ khoá, KHÔNG rút được tiền: quyền duy nhất
//! của nó trên ví là cửa `recovery_rotate` (xem smart-account).
#![no_std]
// events().publish giữ NGUYÊN wire format v1 (topics[0]=Symbol kind, topics[1]=ví)
// mà BE indexer đã parse — #[contractevent] mới của SDK đổi encoding, không dùng.
#![allow(deprecated)]

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error,
    symbol_short, xdr::ToXdr, Address, Env, Vec,
};
use stellar_accounts::smart_account::Signer;

/// Giữ nguyên bảng mã v1 (1..16) — BE dịch `Error(Contract, #N)` theo tên này.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RegistryError {
    AlreadyRegistered = 1,
    NotRegistered = 2,
    InvalidThreshold = 3,
    TooFewGuardians = 4,
    TooManyGuardians = 5,
    NotAGuardian = 6,
    RecoveryInProgress = 7,
    NoActiveRecovery = 8,
    ThresholdNotMet = 9,
    TimelockNotElapsed = 10,
    AlreadyApproved = 11,
    RecoveryCancelled = 12,
    AlreadyFinalized = 13,
    GuardianExists = 14,
    GuardianNotFound = 15,
    DuplicateGuardian = 16,
}

const MAX_GUARDIANS: u32 = 10;

/// Cửa xoay khoá trên smart account (xem smart-account::recovery_rotate).
#[contractclient(name = "AccountClient")]
pub trait RecoveryAccount {
    fn recovery_rotate(e: Env, new_signer: Signer);
}

#[contracttype]
#[derive(Clone)]
pub struct WalletConfig {
    pub guardians: Vec<Address>,
    /// = wallet (địa chỉ ví KHÔNG đổi sau khôi phục — khoá đổi bên trong).
    /// Giữ field cho tương thích shape v1 mà BE đã đọc.
    pub owner: Address,
    pub threshold: u32,
    pub timelock_secs: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RecoveryStatus {
    Pending,
    Approved,
    Finalized,
    Cancelled,
}

#[contracttype]
#[derive(Clone)]
pub struct RecoveryRequest {
    pub approvals: Vec<Address>,
    /// Khoá mới sẽ được cài vào ví khi finalize — guardian phê duyệt ĐÚNG nó.
    pub new_signer: Signer,
    pub started_at: u64,
    pub status: RecoveryStatus,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Config(Address),
    Request(Address),
}

#[contract]
pub struct RecoveryRegistry;

fn config(e: &Env, wallet: &Address) -> WalletConfig {
    e.storage()
        .persistent()
        .get(&DataKey::Config(wallet.clone()))
        .unwrap_or_else(|| panic_with_error!(e, RegistryError::NotRegistered))
}

fn request(e: &Env, wallet: &Address) -> RecoveryRequest {
    e.storage()
        .persistent()
        .get(&DataKey::Request(wallet.clone()))
        .unwrap_or_else(|| panic_with_error!(e, RegistryError::NoActiveRecovery))
}

/// Request đang SỐNG (Pending/Approved) — chặn đổi cấu hình + initiate chồng.
fn active_request(e: &Env, wallet: &Address) -> Option<RecoveryRequest> {
    let req: Option<RecoveryRequest> = e
        .storage()
        .persistent()
        .get(&DataKey::Request(wallet.clone()));
    req.filter(|r| matches!(r.status, RecoveryStatus::Pending | RecoveryStatus::Approved))
}

fn save_config(e: &Env, wallet: &Address, cfg: &WalletConfig) {
    e.storage()
        .persistent()
        .set(&DataKey::Config(wallet.clone()), cfg);
}

fn save_request(e: &Env, wallet: &Address, req: &RecoveryRequest) {
    e.storage()
        .persistent()
        .set(&DataKey::Request(wallet.clone()), req);
}

/// Fingerprint sha256 của Signer (XDR) — nhét vào event cho indexer/UI đối chiếu
/// (Signer nguyên khối to + không cần thiết trong topic/data).
fn signer_fingerprint(e: &Env, signer: &Signer) -> soroban_sdk::BytesN<32> {
    e.crypto().sha256(&signer.clone().to_xdr(e)).to_bytes()
}

#[contractimpl]
impl RecoveryRegistry {
    /// Ví TỰ đăng ký (passkey ký qua __check_auth). Chống lockout từ gốc:
    /// threshold ∈ [1, số guardian], guardian không trùng, không phải chính ví.
    pub fn register_wallet(
        e: &Env,
        wallet: Address,
        guardians: Vec<Address>,
        threshold: u32,
        timelock_secs: u64,
    ) {
        wallet.require_auth();
        if e.storage()
            .persistent()
            .has(&DataKey::Config(wallet.clone()))
        {
            panic_with_error!(e, RegistryError::AlreadyRegistered);
        }
        if guardians.is_empty() {
            panic_with_error!(e, RegistryError::TooFewGuardians);
        }
        if guardians.len() > MAX_GUARDIANS {
            panic_with_error!(e, RegistryError::TooManyGuardians);
        }
        if threshold == 0 || threshold > guardians.len() {
            panic_with_error!(e, RegistryError::InvalidThreshold);
        }
        for (i, g) in guardians.iter().enumerate() {
            if g == wallet {
                // Ví tự làm guardian của mình = veto/approve vô nghĩa.
                panic_with_error!(e, RegistryError::DuplicateGuardian);
            }
            for j in (i + 1)..guardians.len() as usize {
                if g == guardians.get_unchecked(j as u32) {
                    panic_with_error!(e, RegistryError::DuplicateGuardian);
                }
            }
        }
        let cfg = WalletConfig {
            guardians,
            owner: wallet.clone(),
            threshold,
            timelock_secs,
        };
        save_config(e, &wallet, &cfg);
        e.events().publish(
            (symbol_short!("register"), wallet),
            (threshold, timelock_secs),
        );
    }

    pub fn add_guardian(e: &Env, wallet: Address, new_guardian: Address) {
        wallet.require_auth();
        let mut cfg = config(e, &wallet);
        if active_request(e, &wallet).is_some() {
            panic_with_error!(e, RegistryError::RecoveryInProgress);
        }
        if new_guardian == wallet {
            panic_with_error!(e, RegistryError::DuplicateGuardian);
        }
        if cfg.guardians.contains(&new_guardian) {
            panic_with_error!(e, RegistryError::GuardianExists);
        }
        if cfg.guardians.len() >= MAX_GUARDIANS {
            panic_with_error!(e, RegistryError::TooManyGuardians);
        }
        cfg.guardians.push_back(new_guardian.clone());
        save_config(e, &wallet, &cfg);
        e.events()
            .publish((symbol_short!("g_add"), wallet), new_guardian);
    }

    /// CHỐNG LOCKOUT: không cho rớt xuống dưới threshold (đổi threshold trước đã).
    pub fn remove_guardian(e: &Env, wallet: Address, guardian: Address) {
        wallet.require_auth();
        let mut cfg = config(e, &wallet);
        if active_request(e, &wallet).is_some() {
            panic_with_error!(e, RegistryError::RecoveryInProgress);
        }
        let Some(pos) = cfg.guardians.first_index_of(&guardian) else {
            panic_with_error!(e, RegistryError::GuardianNotFound);
        };
        if cfg.guardians.len() - 1 < cfg.threshold {
            panic_with_error!(e, RegistryError::InvalidThreshold);
        }
        cfg.guardians.remove_unchecked(pos);
        save_config(e, &wallet, &cfg);
        e.events()
            .publish((symbol_short!("g_remove"), wallet), guardian);
    }

    /// Guardian mở khôi phục, CHỞ KHOÁ MỚI thật (phiếu = phê duyệt đúng khoá này).
    /// Initiator được đếm là phiếu đầu tiên.
    pub fn initiate_recovery(e: &Env, wallet: Address, new_signer: Signer, initiator: Address) {
        initiator.require_auth();
        let cfg = config(e, &wallet);
        if !cfg.guardians.contains(&initiator) {
            panic_with_error!(e, RegistryError::NotAGuardian);
        }
        if active_request(e, &wallet).is_some() {
            panic_with_error!(e, RegistryError::RecoveryInProgress);
        }
        let mut approvals = Vec::new(e);
        approvals.push_back(initiator.clone());
        let req = RecoveryRequest {
            approvals,
            new_signer: new_signer.clone(),
            started_at: e.ledger().timestamp(),
            status: if cfg.threshold <= 1 {
                RecoveryStatus::Approved
            } else {
                RecoveryStatus::Pending
            },
        };
        save_request(e, &wallet, &req);
        e.events().publish(
            (symbol_short!("initiate"), wallet),
            (initiator, signer_fingerprint(e, &new_signer)),
        );
    }

    pub fn approve_recovery(e: &Env, wallet: Address, guardian: Address) {
        guardian.require_auth();
        let cfg = config(e, &wallet);
        if !cfg.guardians.contains(&guardian) {
            panic_with_error!(e, RegistryError::NotAGuardian);
        }
        let mut req = request(e, &wallet);
        match req.status {
            RecoveryStatus::Cancelled => panic_with_error!(e, RegistryError::RecoveryCancelled),
            RecoveryStatus::Finalized => panic_with_error!(e, RegistryError::AlreadyFinalized),
            RecoveryStatus::Pending | RecoveryStatus::Approved => {}
        }
        if req.approvals.contains(&guardian) {
            panic_with_error!(e, RegistryError::AlreadyApproved);
        }
        req.approvals.push_back(guardian.clone());
        if req.approvals.len() >= cfg.threshold {
            req.status = RecoveryStatus::Approved;
        }
        save_request(e, &wallet, &req);
        e.events().publish(
            (symbol_short!("approve"), wallet),
            (guardian, req.approvals.len()),
        );
    }

    /// VETO — chính ví ký (khoá còn sống nào cũng chặn được, qua __check_auth).
    pub fn cancel_recovery(e: &Env, wallet: Address) {
        wallet.require_auth();
        let mut req = request(e, &wallet);
        match req.status {
            RecoveryStatus::Cancelled => panic_with_error!(e, RegistryError::RecoveryCancelled),
            RecoveryStatus::Finalized => panic_with_error!(e, RegistryError::AlreadyFinalized),
            RecoveryStatus::Pending | RecoveryStatus::Approved => {}
        }
        req.status = RecoveryStatus::Cancelled;
        save_request(e, &wallet, &req);
        e.events().publish((symbol_short!("cancel"), wallet), ());
    }

    /// Ai crank cũng được SAU timelock (không đòi auth người dùng) — timelock
    /// on-chain là người gác. XOAY KHOÁ THẬT trên smart account rồi mới Finalized.
    pub fn finalize_recovery(e: &Env, wallet: Address) {
        let cfg = config(e, &wallet);
        let mut req = request(e, &wallet);
        match req.status {
            RecoveryStatus::Cancelled => panic_with_error!(e, RegistryError::RecoveryCancelled),
            RecoveryStatus::Finalized => panic_with_error!(e, RegistryError::AlreadyFinalized),
            RecoveryStatus::Pending | RecoveryStatus::Approved => {}
        }
        if req.approvals.len() < cfg.threshold {
            panic_with_error!(e, RegistryError::ThresholdNotMet);
        }
        let elapsed = e.ledger().timestamp().saturating_sub(req.started_at);
        if elapsed < cfg.timelock_secs {
            panic_with_error!(e, RegistryError::TimelockNotElapsed);
        }

        // Trái tim của v2: khoá đổi BÊN TRONG ví. Registry là direct invoker nên
        // require_auth(registry) trong recovery_rotate tự thoả (invoker auth).
        AccountClient::new(e, &wallet).recovery_rotate(&req.new_signer);

        req.status = RecoveryStatus::Finalized;
        save_request(e, &wallet, &req);
        e.events().publish(
            (symbol_short!("finalize"), wallet),
            signer_fingerprint(e, &req.new_signer),
        );
    }

    // ---- Views (shape v1) ----

    pub fn is_registered(e: &Env, wallet: Address) -> bool {
        e.storage().persistent().has(&DataKey::Config(wallet))
    }

    pub fn get_wallet_config(e: &Env, wallet: Address) -> WalletConfig {
        config(e, &wallet)
    }

    pub fn get_recovery_status(e: &Env, wallet: Address) -> RecoveryRequest {
        request(e, &wallet)
    }

    /// 0 = hết timelock (finalize được nếu đủ phiếu). Panic nếu không có request.
    pub fn timelock_remaining(e: &Env, wallet: Address) -> u64 {
        let cfg = config(e, &wallet);
        let req = request(e, &wallet);
        let elapsed = e.ledger().timestamp().saturating_sub(req.started_at);
        cfg.timelock_secs.saturating_sub(elapsed)
    }
}

#[cfg(test)]
mod test;

/// Cửa test-only cho vector chéo ngôn ngữ (test.rs) — không có trong wasm build.
#[cfg(test)]
pub(crate) fn test_support_fingerprint(e: &Env, signer: &Signer) -> soroban_sdk::BytesN<32> {
    signer_fingerprint(e, signer)
}
