import { useState, type FormEvent } from "react";
import { Button, Field, Input, Select, Sheet } from "../../components/ui";
import { accountRepo, ValidationError } from "../../db/repo";
import type { Account, AccountType } from "../../db/types";
import { cn } from "../../lib/cn";
import { formatAmountInput } from "../budgets/helpers";
import {
  ACCOUNT_COLORS,
  ACCOUNT_TYPES,
  accountToForm,
  emptyAccountForm,
  formToAccountInput,
  type AccountForm as AccountFormState,
} from "./helpers";

interface AccountFormProps {
  open: boolean;
  onClose: () => void;
  account: Account | null;
}

/** Sheet가 닫히면 자식이 언마운트되므로 폼 상태는 열릴 때마다 새로 초기화된다 */
export function AccountForm(props: AccountFormProps) {
  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title={props.account ? "계좌 수정" : "계좌 추가"}
    >
      <AccountFormBody {...props} />
    </Sheet>
  );
}

function AccountFormBody({ onClose, account }: AccountFormProps) {
  const [form, setForm] = useState<AccountFormState>(() =>
    account ? accountToForm(account) : emptyAccountForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<AccountFormState>) =>
    setForm((f) => ({ ...f, ...p }));

  const flipSign = () => {
    const v = form.initialBalance.trim();
    patch({
      initialBalance: v.startsWith("-") ? v.slice(1) : v ? `-${v}` : "-",
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const input = formToAccountInput(form);
      if (account) await accountRepo.update(account.id, input);
      else await accountRepo.add(input);
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
      <Field label="이름" htmlFor="acc-name">
        <Input
          id="acc-name"
          placeholder="예: 국민 주거래, 현대카드"
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          autoFocus
        />
      </Field>

      <Field label="종류" htmlFor="acc-type">
        <Select
          id="acc-type"
          value={form.type}
          onChange={(e) => patch({ type: e.target.value as AccountType })}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.emoji} {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="초기 잔액"
        htmlFor="acc-initial"
        hint="(앱 사용 시작 시점, 카드 미결제액은 음수)"
      >
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={flipSign}
            aria-label="부호 바꾸기"
            className="w-11 shrink-0 h-11 text-lg"
          >
            ±
          </Button>
          <Input
            id="acc-initial"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={form.initialBalance}
            onChange={(e) =>
              patch({ initialBalance: formatAmountInput(e.target.value, true) })
            }
            className="tnum text-right"
          />
        </div>
      </Field>

      <div>
        <span className="block text-xs font-medium text-muted mb-1">색상</span>
        <div
          role="radiogroup"
          aria-label="색상"
          className="grid grid-cols-6 gap-2"
        >
          {ACCOUNT_COLORS.map((c) => {
            const selected = form.color === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={c}
                onClick={() => patch({ color: c })}
                className={cn(
                  "h-9 rounded-full border-2 transition",
                  selected ? "border-text scale-105" : "border-transparent",
                )}
                style={{ background: c }}
              />
            );
          })}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-expense">
          {error}
        </p>
      )}

      <Button type="submit" full disabled={saving}>
        {account ? "저장" : "추가"}
      </Button>
    </form>
  );
}
