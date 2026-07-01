import { useState, type FormEvent } from "react";
import * as cls from "../ui/cls";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTopic, discoverUpdates, listTopics, updateTopic } from "../api/endpoints";
import type { TelegramTopic } from "../api/types";
import { Button, Card, Empty, ErrorBox, Modal, Spinner } from "../components/ui";
import { useI18n } from "../i18n";

const EMPTY = { name: "", chat_id: "", message_thread_id: "", is_default: false };

export default function TopicsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [formError, setFormError] = useState<string | null>(null);
  const [showDiscover, setShowDiscover] = useState(false);

  const topics = useQuery({ queryKey: ["topics"], queryFn: listTopics });
  const discover = useQuery({
    queryKey: ["telegram-updates"],
    queryFn: discoverUpdates,
    enabled: showDiscover,
  });

  const create = useMutation({
    mutationFn: () =>
      createTopic({
        name: form.name,
        chat_id: Number(form.chat_id),
        message_thread_id: form.message_thread_id ? Number(form.message_thread_id) : null,
        is_default: form.is_default,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["topics"] });
      setCreating(false);
      setForm({ ...EMPTY });
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : t("common.somethingWrong")),
  });

  const toggle = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<TelegramTopic> }) =>
      updateTopic(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topics"] }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    create.mutate();
  }

  return (
    <div className={cls.page}>
      <div className={cls.pageHead}>
        <h1>{t("topics.title")}</h1>
        <div>
          <Button variant="ghost" onClick={() => setShowDiscover(true)}>
            {t("topics.discover")}
          </Button>
          <Button onClick={() => setCreating(true)} style={{ marginLeft: 8 }}>
            {t("topics.new")}
          </Button>
        </div>
      </div>

      <p className={cls.muted} style={{ marginTop: -8, marginBottom: 16 }}>
        {t("topics.subtitle")}
      </p>

      <Card>
        {topics.isLoading ? (
          <Spinner />
        ) : topics.error ? (
          <ErrorBox error={topics.error} />
        ) : topics.data && topics.data.length > 0 ? (
          <table className={cls.table}>
            <thead>
              <tr>
                <th>{t("col.name")}</th>
                <th className={cls.numCell}>{t("col.chatId")}</th>
                <th className={cls.numCell}>{t("col.threadId")}</th>
                <th>{t("col.default")}</th>
                <th>{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {topics.data.map((topic) => (
                <tr key={topic.id}>
                  <td>{topic.name}</td>
                  <td className={cls.cx(cls.numCell, cls.mono)}>{topic.chat_id}</td>
                  <td className={cls.cx(cls.numCell, cls.mono)}>{topic.message_thread_id ?? "—"}</td>
                  <td>
                    {topic.is_default ? (
                      <span className={cls.badge.blue}>{t("topics.defaultBadge")}</span>
                    ) : (
                      <button
                        className={cls.chip}
                        onClick={() => toggle.mutate({ id: topic.id, patch: { is_default: true } })}
                      >
                        {t("topics.setDefault")}
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      className={cls.cx(cls.chip, topic.is_active && cls.chipActive)}
                      onClick={() =>
                        toggle.mutate({ id: topic.id, patch: { is_active: !topic.is_active } })
                      }
                    >
                      {topic.is_active ? t("topics.activeBtn") : t("topics.inactiveBtn")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{t("topics.empty")}</Empty>
        )}
      </Card>

      {creating && (
        <Modal title={t("topics.newTitle")} onClose={() => setCreating(false)}>
          <form onSubmit={submit}>
            <label className={cls.field}>
              <span>{t("field.topicName")}</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Before/After"
                required
              />
            </label>
            <div className={cls.formGrid}>
              <label className={cls.field}>
                <span>{t("field.chatId")}</span>
                <input
                  value={form.chat_id}
                  onChange={(e) => setForm({ ...form, chat_id: e.target.value })}
                  placeholder="-1001234567890"
                  required
                />
              </label>
              <label className={cls.field}>
                <span>{t("field.threadId")}</span>
                <input
                  value={form.message_thread_id}
                  onChange={(e) => setForm({ ...form, message_thread_id: e.target.value })}
                  placeholder="12"
                />
              </label>
            </div>
            <label className={cls.checkboxField}>
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              />
              {t("topics.makeDefault")}
            </label>
            {formError && <div className={cls.errorBox}>{formError}</div>}
            <div className={cls.modalActions}>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? t("common.saving") : t("topics.create")}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showDiscover && (
        <Modal title={t("topics.discoverTitle")} onClose={() => setShowDiscover(false)}>
          <p className={cls.muted}>{t("topics.discoverHelp")}</p>
          {discover.isLoading ? (
            <Spinner />
          ) : discover.error ? (
            <ErrorBox error={discover.error} />
          ) : discover.data && discover.data.length > 0 ? (
            <table className={cls.table}>
              <thead>
                <tr>
                  <th>{t("topics.colChat")}</th>
                  <th className={cls.numCell}>{t("col.chatId")}</th>
                  <th className={cls.numCell}>{t("col.threadId")}</th>
                  <th>{t("topics.colTopicText")}</th>
                </tr>
              </thead>
              <tbody>
                {discover.data.map((u, i) => (
                  <tr key={i}>
                    <td>{u.chat_title ?? u.chat_type ?? "—"}</td>
                    <td className={cls.cx(cls.numCell, cls.mono)}>{u.chat_id ?? "—"}</td>
                    <td className={cls.cx(cls.numCell, cls.mono)}>{u.message_thread_id ?? "—"}</td>
                    <td>{u.topic_name ?? u.text ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>{t("topics.noUpdates")}</Empty>
          )}
          <div className={cls.modalActions}>
            <Button variant="ghost" onClick={() => discover.refetch()}>
              {t("topics.refresh")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
