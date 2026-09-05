import { useState, type FormEvent } from "react";
import {
  Button,
  Field,
  Input,
  Segmented,
  Select,
  Sheet,
} from "../../components/ui";
import { recurringRepo, ValidationError } from "../../db/repo";
import type { Account, Category, RecurringRule, TxType } from "../../db/types";
import type { MonthKey } from "../../domain/dates";
import { formatAmountInput } from "../budgets/helpers";
import {
  emptyRuleForm,
  formToRuleInput,
  groupCategories,
  kindOfType,
  ruleToForm,
  type RuleForm,
} from "./helpers";

interface RecurringFormProps {
  open: boolean;
  onClose: () => void;
  rule: RecurringRule | null;
  categories: Category[];
  accounts: Account[];
  currentMonth: MonthKey;
  onDelete?: (rule: RecurringRule) => void;
}

/** Sheet가 닫히면 자식이 언마운트되므로 폼 상태는 열릴 때마다 새로 초기화된다 */
export function RecurringForm(props: RecurringFormProps) {
  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title={props.rule ? "반복 거래 수정" : "반복 거래 추가"}
    >
      <RuleFormBody {...props} />
    </Sheet>
  );
}

function RuleFormBody({
  onClose,
  rule,
  categories,
  accounts,
  currentMonth,
  onDelete,
}: RecurringFormProps) {
  const [form, setForm] = useState<RuleForm>(() =>
    rule ? ruleToForm(rule) : emptyRuleForm(currentMonth),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<RuleForm>) => setForm((f) => ({ ...f, ...p }));
  const kind = kindOfType(form.type);
  const groups = kind ? groupCategories(categories, kind) : [];
  const selectable = accounts.filter(
    (a) =>
      !a.isArchived || a.id === form.accountId || a.id === form.toAccountId,
  );

  const changeType = (type: TxType) => {
    // 종류가 바뀌면 다른 종류의 카테고리는 무효
    setForm((f) => ({
      ...f,
      type,
      categoryId: kindOfType(type) === kindOfType(f.type) ? f.categoryId : "",
    }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const input = formToRuleInput(form);
      if (rule) await recurringRepo.update(rule.id, input);
      else await recurringRepo.add(input);
      onClose();
    } catch (err) {
      setError(
        err instanceof ValidationError ? err.message : "저장하지 못했습니다",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Segmented<TxType>
        value={form.type}
        onChange={changeType}
        options={[
          { value: "expense", label: "지출", activeClass: "text-expense" },
          { value: "income", label: "수입", activeClass: "text-income" },
          { value: "transfer", label: "이체", activeClass: "text-transfer" },
        ]}
      />

      <Field label="금액" htmlFor="rule-amount">
        <Input
          id="rule-amount"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={form.amount}
          onChange={(e) => patch({ amount: formatAmountInput(e.target.value) })}
          className="tnum text-right"
        />
      </Field>

      {kind && (
        <Field label="카테고리" htmlFor="rule-category">
          <Select
            id="rule-category"
            value={form.categoryId}
            onChange={(e) => patch({ categoryId: e.target.value })}
          >
            <option value="">미분류</option>
            {groups.map((g) => (
              <optgroup
                key={g.parent.id}
                label={`${g.parent.emoji} ${g.parent.name}`}
              >
                <option value={g.parent.id}>
                  {g.parent.emoji} {g.parent.name}
                </option>
                {g.children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {"  "}
                    {c.emoji} {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
      )}

      <Field
        label={form.type === "transfer" ? "출금 계좌" : "계좌"}
        htmlFor="rule-account"
      >
        <Select
          id="rule-account"
          value={form.accountId}
          onChange={(e) => patch({ accountId: e.target.value })}
        >
          <option value="">계좌 없음</option>
          {selectable.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>

      {form.type === "transfer" && (
        <Field
          label="입금 계좌"
          htmlFor="rule-to-account"
          error={
            form.accountId && form.accountId === form.toAccountId
              ? "출금 계좌와 입금 계좌가 같을 수 없습니다"
              : null
          }
        >
          <Select
            id="rule-to-account"
            value={form.toAccountId}
            onChange={(e) => patch({ toAccountId: e.target.value })}
          >
            <option value="">계좌 선택</option>
            {selectable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="거래처" htmlFor="rule-payee">
        <Input
          id="rule-payee"
          placeholder="예: 월세, 넷플릭스"
          value={form.payee}
          onChange={(e) => patch({ payee: e.target.value })}
        />
      </Field>

      <Field label="메모" htmlFor="rule-memo">
        <Input
          id="rule-memo"
          value={form.memo}
          onChange={(e) => patch({ memo: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="반복일" htmlFor="rule-day" hint="(1~31)">
          <Input
            id="rule-day"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            step={1}
            value={form.dayOfMonth}
            onChange={(e) => patch({ dayOfMonth: e.target.value })}
            className="tnum"
          />
        </Field>
        <Field label="시작 월" htmlFor="rule-start">
          <Input
            id="rule-start"
            type="month"
            value={form.startMonth}
            onChange={(e) => patch({ startMonth: e.target.value })}
            className="tnum"
          />
        </Field>
        <Field label="종료 월" htmlFor="rule-end" hint="(선택)">
          <Input
            id="rule-end"
            type="month"
            value={form.endMonth}
            onChange={(e) => patch({ endMonth: e.target.value })}
            className="tnum"
          />
        </Field>
      </div>
      <p className="text-xs text-muted -mt-2">
        없는 날짜는 말일로 등록됩니다. (예: 31일 → 2월 28일)
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => patch({ isActive: e.target.checked })}
          className="h-4 w-4 accent-accent"
        />
        활성 (꺼두면 자동 등록되지 않음)
      </label>

      {error && (
        <p role="alert" className="text-sm text-expense">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {rule && onDelete && (
          <Button type="button" variant="danger" onClick={() => onDelete(rule)}>
            삭제
          </Button>
        )}
        <Button type="submit" full disabled={saving}>
          {rule ? "저장" : "추가"}
        </Button>
      </div>
    </form>
  );
}
