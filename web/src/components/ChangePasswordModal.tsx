import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { changePassword } from "../api/endpoints";
import { useI18n } from "../i18n";
import { Button, ErrorBox, Modal } from "./ui";

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const save = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => setDone(true),
    onError: (e) => setError(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  return (
    <Modal title={t("common.changePassword")} onClose={onClose}>
      {done ? (
        <>
          <div className="ok-box">{t("changePw.done")}</div>
          <div className="modal-actions">
            <Button onClick={onClose}>{t("common.cancel")}</Button>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          <label className="field">
            <span>{t("changePw.current")}</span>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="field">
            <span>{t("changePw.new")}</span>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          {error && <ErrorBox error={error} />}
          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={save.isPending || !current || !next}>
              {save.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
