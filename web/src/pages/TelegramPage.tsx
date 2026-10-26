import { useState } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateTelegramCode,
  getTelegramBot,
  listTelegramUsers,
  syncTelegramLinks,
  unlinkTelegramUser,
  type TelegramLinkCode,
  type TelegramLinkUser,
} from "../api/endpoints";
import { Button, Card, Empty, ErrorBox, Modal, Spinner } from "../components/ui";
import { useI18n } from "../i18n";

export default function TelegramPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [codeFor, setCodeFor] = useState<{ user: TelegramLinkUser; data: TelegramLinkCode } | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const bot = useQuery({ queryKey: ["telegram-bot"], queryFn: getTelegramBot });
  const users = useQuery({ queryKey: ["telegram-users"], queryFn: listTelegramUsers });

  const genCode = useMutation({
    mutationFn: (u: TelegramLinkUser) => generateTelegramCode(u.id),
    onSuccess: (data, u) => {
      setCodeFor({ user: u, data });
      qc.invalidateQueries({ queryKey: ["telegram-users"] });
    },
  });
  const unlink = useMutation({
    mutationFn: (id: number) => unlinkTelegramUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telegram-users"] }),
  });
  const sync = useMutation({
    mutationFn: () => syncTelegramLinks(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["telegram-users"] });
      setSyncMsg(
        res.linked.length > 0
          ? t("telegram.syncLinked", { names: res.linked.join(", ") })
          : t("telegram.syncNone"),
      );
    },
  });

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <div>
          <h1>{t("telegram.title")}</h1>
          <p className={cls.muted} style={{ margin: 0 }}>{t("telegram.subtitle")}</p>
        </div>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
          {sync.isPending ? t("telegram.syncing") : t("telegram.sync")}
        </Button>
      </div>

      {/* Bot status */}
      <Card>
        {bot.isLoading ? (
          <Spinner />
        ) : bot.error ? (
          <ErrorBox error={bot.error} />
        ) : bot.data ? (
          !bot.data.configured ? (
            <div className={cls.cx(cls.badge.red)}>{t("telegram.botMissing")}</div>
          ) : bot.data.error ? (
            <div>
              <span className={cls.badge.amber}>{t("telegram.botError")}</span>
              <div className={cls.cx(cls.muted, cls.small)} style={{ marginTop: 6 }}>{bot.data.error}</div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className={cls.badge.green}>{t("telegram.botOk")}</span>
              {bot.data.username && (
                <a
                  href={`https://t.me/${bot.data.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cls.mono}
                >
                  @{bot.data.username}
                </a>
              )}
            </div>
          )
        ) : null}
      </Card>

      {syncMsg && (
        <Card>
          <div className={cls.cx(cls.small)}>{syncMsg}</div>
        </Card>
      )}

      {(genCode.error || unlink.error || sync.error) && (
        <ErrorBox error={genCode.error || unlink.error || sync.error} />
      )}

      {/* Users */}
      <Card>
        {users.isLoading ? (
          <Spinner />
        ) : users.error ? (
          <ErrorBox error={users.error} />
        ) : users.data && users.data.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.name")}</th>
                <th>{t("col.role")}</th>
                <th>{t("telegram.status")}</th>
                <th className={cls.actionsCol} />
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.full_name}
                    <div className={cls.cx(cls.muted, cls.small)}>{u.email}</div>
                  </td>
                  <td className={cls.muted}>{u.role}</td>
                  <td>
                    {u.linked ? (
                      <span className={cls.badge.green}>
                        {t("telegram.linked")}
                        {u.telegram_username ? ` · ${u.telegram_username}` : ""}
                      </span>
                    ) : u.has_code ? (
                      <span className={cls.badge.amber}>{t("telegram.awaiting")}</span>
                    ) : (
                      <span className={cls.badge.gray}>{t("telegram.notLinked")}</span>
                    )}
                  </td>
                  <td className={cls.actionsCol}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Button
                        variant="ghost"
                        disabled={genCode.isPending}
                        onClick={() => genCode.mutate(u)}
                      >
                        {u.linked || u.has_code ? t("telegram.relink") : t("telegram.link")}
                      </Button>
                      {u.linked && (
                        <Button
                          variant="danger"
                          disabled={unlink.isPending}
                          onClick={() => unlink.mutate(u.id)}
                        >
                          {t("telegram.unlink")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{t("telegram.empty")}</Empty>
        )}
      </Card>

      {codeFor && (
        <CodeModal
          user={codeFor.user}
          data={codeFor.data}
          onClose={() => setCodeFor(null)}
        />
      )}
    </div>
  );
}

function CodeModal({
  user,
  data,
  onClose,
}: {
  user: TelegramLinkUser;
  data: TelegramLinkCode;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  return (
    <Modal title={t("telegram.codeTitle", { name: user.full_name })} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0 }}>{t("telegram.codeHint")}</p>

        {data.link ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <a href={data.link} target="_blank" rel="noreferrer" className={cls.mono}>
              {data.link}
            </a>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" onClick={() => copy(data.link!)}>
                {copied ? t("telegram.copied") : t("telegram.copyLink")}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className={cls.cx(cls.muted, cls.small)}>{t("telegram.codeManual")}</div>
            <div className={cls.mono} style={{ fontSize: 20, marginTop: 4 }}>
              /start {data.code}
            </div>
            <Button variant="ghost" onClick={() => copy(`/start ${data.code}`)} style={{ marginTop: 6 }}>
              {copied ? t("telegram.copied") : t("telegram.copyCode")}
            </Button>
          </div>
        )}

        <div className={cls.cx(cls.small)} style={{ marginTop: 4 }}>
          {t("telegram.afterStart")}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={onClose}>{t("common.close")}</Button>
        </div>
      </div>
    </Modal>
  );
}
