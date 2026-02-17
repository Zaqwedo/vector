"use client";

import { useRef } from "react";
import { toggleNoteAction } from "@/app/actions";

type Props = {
  id: number;
  noteDate: string;
  done: boolean;
  text: string;
};

export function NoteCheckbox({ id, noteDate, done, text }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={toggleNoteAction} className="note-row">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="note_date" value={noteDate} />
      <input type="hidden" name="done" value={done ? "0" : "1"} />
      <label className="note-check">
        <input
          type="checkbox"
          checked={done}
          onChange={() => {
            formRef.current?.requestSubmit();
          }}
        />
        <span className={done ? "note-done" : ""}>{text}</span>
      </label>
    </form>
  );
}
