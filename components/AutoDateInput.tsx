"use client";

import { useRef } from "react";

type Props = {
  action: string;
  value: string;
  className?: string;
};

export function AutoDateInput({ action, value, className }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="get" action={action} className="date-form">
      <input
        className={className ?? "date-link"}
        type="date"
        name="date"
        defaultValue={value}
        onChange={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}
