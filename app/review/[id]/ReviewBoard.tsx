'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ConfidenceBadge,
  StatusChip,
  UrgencyBadge,
  ProvenanceTag,
} from '@/components/Badges';
import { EvidencePanel } from '@/components/EvidencePanel';
import type { ActionItem, ExtractedField } from '@/lib/types';
import { fieldLabel } from '@/lib/utils';

export function ReviewBoard({
  judgmentId,
  fields,
  actions,
}: {
  judgmentId: number;
  fields: ExtractedField[];
  actions: ActionItem[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reviewField(
    field: ExtractedField,
    decision: 'Approved' | 'Edited' | 'Rejected',
    nextValue?: string,
    comment?: string
  ) {
    setBusyId(`f-${field.id}`);
    await fetch(`/api/fields/${field.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        new_value: nextValue,
        comment,
      }),
    });
    setBusyId(null);
    start(() => router.refresh());
  }

  async function reviewAction(
    a: ActionItem,
    decision: 'Approved' | 'Rejected' | 'Edited' | 'Completed',
    patch?: Partial<{
      title: string;
      description: string;
      department: string;
      due_date: string | null;
      needs_officer_review: boolean;
      comment: string;
    }>
  ) {
    setBusyId(`a-${a.id}`);
    await fetch(`/api/actions/${a.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, ...patch }),
    });
    setBusyId(null);
    start(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <section className="gov-card">
        <div className="gov-card-header flex items-center justify-between">
          <h2 className="gov-h2">Extracted fields</h2>
          <span className="text-[12px] text-gov-slate">
            Approve, edit or reject each field. Edits replace the AI value.
          </span>
        </div>
        <ul className="divide-y divide-slate-100">
          {fields.map((f) => (
            <FieldRow
              key={f.id}
              field={f}
              busy={busyId === `f-${f.id}`}
              onDecide={reviewField}
            />
          ))}
          {fields.length === 0 && (
            <li className="px-5 py-8 text-center text-gov-slate">No fields extracted.</li>
          )}
        </ul>
      </section>

      <section className="gov-card">
        <div className="gov-card-header flex items-center justify-between">
          <h2 className="gov-h2">Action plan items</h2>
          <span className="text-[12px] text-gov-slate">
            Only approved actions appear on the trusted dashboard.
          </span>
        </div>
        <ul className="divide-y divide-slate-100">
          {actions.map((a) => (
            <ActionRow
              key={a.id}
              action={a}
              busy={busyId === `a-${a.id}`}
              onDecide={reviewAction}
            />
          ))}
          {actions.length === 0 && (
            <li className="px-5 py-8 text-center text-gov-slate">No actions suggested.</li>
          )}
        </ul>
      </section>

      <div className="text-xs text-gov-slate">
        Reviewing as <span className="font-medium">demo.officer</span>. Every decision is recorded in the audit trail (judgment #{judgmentId}).
      </div>
    </div>
  );
}

function FieldRow({
  field,
  busy,
  onDecide,
}: {
  field: ExtractedField;
  busy: boolean;
  onDecide: (
    f: ExtractedField,
    decision: 'Approved' | 'Edited' | 'Rejected',
    nextValue?: string,
    comment?: string
  ) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(field.current_value);
  const [comment, setComment] = useState('');

  return (
    <li className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <div className="gov-section-title">{fieldLabel(field.field_key)}</div>

        {!editing ? (
          <div className="text-sm font-medium text-gov-deep mt-0.5 break-words">
            {field.current_value}
          </div>
        ) : (
          <textarea
            className="gov-input mt-1 font-serif"
            rows={3}
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
        )}

        {field.ai_value !== field.current_value && !editing && (
          <div className="text-[11px] text-gov-slate mt-1">
            AI value: <span className="line-through">{field.ai_value}</span>
          </div>
        )}

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <ConfidenceBadge value={field.confidence} />
          <StatusChip status={field.status} />
          <ProvenanceTag verified={field.status === 'Approved' || field.status === 'Edited'} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {!editing && field.status !== 'Approved' && (
            <button
              className="gov-btn-success"
              disabled={busy}
              onClick={() => onDecide(field, 'Approved', undefined, comment || undefined)}
            >
              Approve
            </button>
          )}
          {!editing && (
            <button className="gov-btn-ghost" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          {editing && (
            <>
              <button
                className="gov-btn-primary"
                disabled={busy}
                onClick={() => {
                  onDecide(field, 'Edited', val, comment || undefined);
                  setEditing(false);
                }}
              >
                Save edit
              </button>
              <button
                className="gov-btn-ghost"
                onClick={() => {
                  setEditing(false);
                  setVal(field.current_value);
                }}
              >
                Cancel
              </button>
            </>
          )}
          {field.status !== 'Rejected' && !editing && (
            <button
              className="gov-btn-danger"
              disabled={busy}
              onClick={() => onDecide(field, 'Rejected', undefined, comment || 'Rejected by reviewer')}
            >
              Reject
            </button>
          )}
        </div>

        <input
          className="gov-input mt-2 text-[12px]"
          placeholder="Reviewer comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <div className="md:col-span-2">
        <EvidencePanel
          excerpt={field.source_excerpt}
          page={field.source_page}
          confidence={field.confidence}
          fieldKey={field.field_key}
          judgmentId={field.judgment_id}
          bbox={field.bbox}
        />
        {field.reviewer_comment && (
          <div className="mt-2 text-[12px] text-gov-slate italic">
            Reviewer note: {field.reviewer_comment}
          </div>
        )}
      </div>
    </li>
  );
}

function ActionRow({
  action,
  busy,
  onDecide,
}: {
  action: ActionItem;
  busy: boolean;
  onDecide: (
    a: ActionItem,
    decision: 'Approved' | 'Rejected' | 'Edited' | 'Completed',
    patch?: any
  ) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(action.title);
  const [description, setDescription] = useState(action.description);
  const [department, setDepartment] = useState(action.department);
  const [due, setDue] = useState(action.due_date ?? '');
  const [comment, setComment] = useState('');

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          {!editing ? (
            <div className="font-semibold text-gov-deep">{action.title}</div>
          ) : (
            <input
              className="gov-input font-semibold"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
          <div className="text-[12px] text-gov-slate mt-0.5">
            {action.action_type}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <UrgencyBadge value={action.urgency} />
          <ConfidenceBadge value={action.confidence} />
          <StatusChip status={action.status} />
          <ProvenanceTag verified={action.status === 'Approved' || action.status === 'Completed'} />
        </div>
      </div>

      {action.needs_officer_review && action.status === 'Pending Review' && (
        <div className="border border-amber-300 bg-amber-50 text-amber-900 text-[12px] px-3 py-1.5 rounded-sm mb-2">
          ⚠ Needs officer review — due date or details could not be inferred.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-2">
          {!editing ? (
            <p className="text-sm text-gov-deep">{action.description}</p>
          ) : (
            <textarea
              className="gov-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="gov-section-title">Department</div>
              {!editing ? (
                <div className="text-sm">{action.department}</div>
              ) : (
                <input
                  className="gov-input"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              )}
            </div>
            <div>
              <div className="gov-section-title">Due date</div>
              {!editing ? (
                <div className="text-sm">{action.due_date || '— (officer review)'}</div>
              ) : (
                <input
                  type="date"
                  className="gov-input"
                  value={due ?? ''}
                  onChange={(e) => setDue(e.target.value)}
                />
              )}
            </div>
          </div>
          {(action.ai_title !== action.title ||
            action.ai_description !== action.description ||
            action.ai_department !== action.department ||
            action.ai_due_date !== action.due_date) && !editing && (
            <details className="text-[11px] text-gov-slate">
              <summary>Original AI suggestion</summary>
              <div className="mt-1 space-y-0.5 italic">
                <div>Title: {action.ai_title}</div>
                <div>Department: {action.ai_department}</div>
                <div>Due date: {action.ai_due_date ?? '— (none)'}</div>
                <div>Description: {action.ai_description}</div>
              </div>
            </details>
          )}
        </div>
        <div>
          <EvidencePanel
            excerpt={action.source_excerpt}
            page={action.source_page}
            confidence={action.confidence}
            judgmentId={action.judgment_id}
            bbox={action.bbox}
          />
          {action.reviewer_comment && (
            <div className="mt-2 text-[12px] text-gov-slate italic">
              Reviewer note: {action.reviewer_comment}
            </div>
          )}
          {action.approved_by && (
            <div className="mt-1 text-[12px] text-emerald-800">
              Approved by {action.approved_by}
            </div>
          )}
        </div>
      </div>

      <input
        className="gov-input mt-3 text-[12px]"
        placeholder="Reviewer comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {!editing && action.status !== 'Approved' && (
          <button
            className="gov-btn-success"
            disabled={busy}
            onClick={() => onDecide(action, 'Approved', { comment })}
          >
            Approve
          </button>
        )}
        {!editing && (
          <button className="gov-btn-ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        {editing && (
          <>
            <button
              className="gov-btn-primary"
              disabled={busy}
              onClick={() => {
                onDecide(action, 'Edited', {
                  title,
                  description,
                  department,
                  due_date: due || null,
                  needs_officer_review: false,
                  comment,
                });
                setEditing(false);
              }}
            >
              Save edits
            </button>
            <button
              className="gov-btn-success"
              disabled={busy}
              onClick={() => {
                onDecide(action, 'Approved', {
                  title,
                  description,
                  department,
                  due_date: due || null,
                  needs_officer_review: false,
                  comment,
                });
                setEditing(false);
              }}
            >
              Save & approve
            </button>
            <button
              className="gov-btn-ghost"
              onClick={() => {
                setEditing(false);
                setTitle(action.title);
                setDescription(action.description);
                setDepartment(action.department);
                setDue(action.due_date ?? '');
              }}
            >
              Cancel
            </button>
          </>
        )}
        {action.status === 'Approved' && (
          <button
            className="gov-btn-ghost"
            disabled={busy}
            onClick={() => onDecide(action, 'Completed', { comment })}
          >
            Mark Completed
          </button>
        )}
        {action.status !== 'Rejected' && !editing && (
          <button
            className="gov-btn-danger"
            disabled={busy}
            onClick={() =>
              onDecide(action, 'Rejected', { comment: comment || 'Rejected by reviewer' })
            }
          >
            Reject
          </button>
        )}
      </div>
    </li>
  );
}
