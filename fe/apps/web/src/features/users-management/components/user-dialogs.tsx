import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminUser } from "../api/admin-users-api";
import type { UserMutations } from "../hooks/use-user-mutations";

interface UserDialogProps {
  user: AdminUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutations: UserMutations;
}

/** Đổi vai trò (user ⇄ admin). PESSIMISTIC — close only after the BE confirms. */
export function SetRoleDialog({ user, open, onOpenChange, mutations }: UserDialogProps) {
  const { t } = useTranslation("admin");
  const [role, setRole] = useState<"admin" | "user">(user.role === "admin" ? "admin" : "user");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.dialogs.roleTitle")}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <Select value={role} onValueChange={(v) => setRole(v as "admin" | "user")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">user</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button
            disabled={mutations.setRole.isPending}
            onClick={() =>
              mutations.setRole.mutate(
                { userId: user.id, role },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {t("users.dialogs.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const BAN_DURATIONS = [
  { key: "permanent", seconds: undefined },
  { key: "day", seconds: 60 * 60 * 24 },
  { key: "week", seconds: 60 * 60 * 24 * 7 },
  { key: "month", seconds: 60 * 60 * 24 * 30 },
] as const;

/** Khoá tài khoản với lý do + thời hạn. */
export function BanUserDialog({ user, open, onOpenChange, mutations }: UserDialogProps) {
  const { t } = useTranslation("admin");
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<string>("permanent");

  const seconds = BAN_DURATIONS.find((d) => d.key === duration)?.seconds;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.dialogs.banTitle")}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={reasonId}>{t("users.dialogs.banReason")}</Label>
            <Input
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("users.dialogs.banReasonPlaceholder")}
            />
          </div>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BAN_DURATIONS.map((d) => (
                <SelectItem key={d.key} value={d.key}>
                  {t(`users.dialogs.banDurations.${d.key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={mutations.ban.isPending}
            onClick={() =>
              mutations.ban.mutate(
                {
                  userId: user.id,
                  ...(reason ? { reason } : {}),
                  ...(seconds ? { expiresIn: seconds } : {}),
                },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {t("users.actions.ban")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Đặt mật khẩu mới (BE minPasswordLength = 12). */
export function SetPasswordDialog({ user, open, onOpenChange, mutations }: UserDialogProps) {
  const { t } = useTranslation("admin");
  const passwordId = useId();
  const [password, setPassword] = useState("");
  const tooShort = password.length > 0 && password.length < 12;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.dialogs.passwordTitle")}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={passwordId}>{t("users.dialogs.newPassword")}</Label>
          <Input
            id={passwordId}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {tooShort ? (
            <p className="text-destructive text-sm">{t("users.dialogs.passwordTooShort")}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={password.length < 12 || mutations.setPassword.isPending}
            onClick={() =>
              mutations.setPassword.mutate(
                { userId: user.id, newPassword: password },
                {
                  onSuccess: () => {
                    setPassword("");
                    onOpenChange(false);
                  },
                },
              )
            }
          >
            {t("users.dialogs.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Xoá user — destructive, yêu cầu xác nhận rõ ràng. */
export function RemoveUserDialog({ user, open, onOpenChange, mutations }: UserDialogProps) {
  const { t } = useTranslation("admin");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.dialogs.removeTitle")}</DialogTitle>
          <DialogDescription>
            {t("users.dialogs.removeDescription", { email: user.email })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("users.dialogs.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={mutations.remove.isPending}
            onClick={() =>
              mutations.remove.mutate(user.id, { onSuccess: () => onOpenChange(false) })
            }
          >
            {t("users.actions.remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
