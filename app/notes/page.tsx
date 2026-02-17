import { addNoteAction } from "@/app/actions";
import { AutoDateInput } from "@/components/AutoDateInput";
import { NoteCheckbox } from "@/components/NoteCheckbox";
import { Shell } from "@/components/Shell";
import { getTodayIsoDate, isValidIsoDate } from "@/lib/date";
import { getNotesForDate } from "@/lib/domain";

type SearchParams = Record<string, string | string[] | undefined>;
type NoteItem = { id: number; text: string; done: boolean; note_date: string };
const getParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const dynamic = "force-dynamic";

export default async function NotesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const today = getTodayIsoDate();
  const requestedDate = getParam(params.date);
  const selectedDate = requestedDate && isValidIsoDate(requestedDate) ? requestedDate : today;

  const todayItems: NoteItem[] = await getNotesForDate(selectedDate);

  return (
    <Shell active="notes">
      <section className="card today-card notes-card">
        <section className="today-block">
          <div className="today-head">
            <h1>
              Заметки ·
              <AutoDateInput action="/notes" value={selectedDate} className="date-link" />
            </h1>
          </div>
          <p className="save-note">Показываются заметки выбранной даты.</p>
        </section>

        <section className="today-block">
          <h2>Задачи на день</h2>
          <form action={addNoteAction} className="form">
            <input type="hidden" name="note_date" value={selectedDate} />
            <div className="vector-project-add">
              <input type="text" name="text" maxLength={240} placeholder="Новая заметка" />
              <button type="submit" className="btn-compact">
                Добавить
              </button>
            </div>
          </form>

          <div className="note-list">
            {todayItems.length ? (
              todayItems.map((item: NoteItem) => (
                <NoteCheckbox key={item.id} id={item.id} noteDate={selectedDate} done={item.done} text={item.text} />
              ))
            ) : (
              <p className="month-meta">Сегодня список пуст.</p>
            )}
          </div>
        </section>
      </section>
    </Shell>
  );
}
