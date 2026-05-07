"use client";

// --- [IMPORTY] ---
// React: Základní stavební kameny pro stav (state) a efekty.
// dnd: Knihovna pro přetahování úkolů (Drag and Drop).
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/lib/supabase';

// --- [TYPY (TypeScript)] ---
// Definují "tvar" našich dat, aby editor věděl, co má každý objekt obsahovat.

type Tag = {
  name: string;
  color: string
};

type Todo = {
  id: string;
  text: string;
  description?: string;
  priority: 'none' | 'nice to have' | 'default' | 'high' | 'urgent';
  tags: Tag[]; // Pole štítků vázaných přímo na konkrétní úkol
  completedAt?: string;
};

type Column = {
  id: string;
  title: string;
  taskIds: string[] // Seznam ID úkolů, které v tomto sloupci bydlí
};

type Data = {
  tasks: { [key: string]: Todo };    // "Skladiště" všech úkolů (hledáme v něm podle ID)
  columns: { [key: string]: Column }; // Definice sloupců
  columnOrder: string[];             // Pořadí, v jakém se sloupce vykreslí na obrazovce
  allTags: Tag[];                    // Globální štítky
};

// --- [POČÁTEČNÍ DATA] ---
// Tato struktura se použije, pokud je LocalStorage prázdný.
const initialData: Data = {
  columns: {
    'ideas': { id: 'ideas', title: '💡 Ideas', taskIds: [] },
    'backlog': { id: 'backlog', title: '📋 Backlog', taskIds: [] },
    'in-progress': { id: 'in-progress', title: '🚀 In Progress', taskIds: [] },
    'waiting-room': { id: 'waiting-room', title: '⏳ Waiting Room', taskIds: [] },
    'bench': { id: 'bench', title: '🪑 Bench', taskIds: [] },
    'done': { id: 'done', title: '✅ Done', taskIds: [] },
  },
  columnOrder: ['ideas', 'backlog', 'in-progress', 'waiting-room', 'bench', 'done'],
  tasks: {},
  allTags: [],
};

// --- [STYLY (Tailwind)] ---
// Centrální místo pro design, aby se třídy nemusely vypisovat stokrát v kódu.
const STYLES = {
  card: "group bg-slate-800/90 p-4 rounded-2xl mb-3 border border-slate-700/50 hover:border-indigo-500/50 transition-all shadow-lg relative text-slate-100 text-base font-medium",
  column: "bg-slate-900/50 backdrop-blur-xl w-85 rounded-3xl p-5 flex flex-col border border-slate-800 shadow-2xl shrink-0",
  input: "w-full bg-slate-950/40 p-4 rounded-xl text-base border border-slate-800 focus:border-indigo-500/50 outline-none transition-all"
};

export default function Kanban() {
  // --- [STAV (State)] ---
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<Data | null>(null);
  const [editingTask, setEditingTask] = useState<{ task: Todo, colId: string } | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Fix pro Next.js: Zajišťuje, aby se Drag&Drop spustil až ve chvíli, kdy je prohlížeč připraven.
  const [enabled, setEnabled] = useState(false);

  // --- [DETEKTIVNÍ PRÁCE: Proč štítky zlobily?] ---
  // Tady (allExistingTags) se kód pokoušel "vydolovat" štítky zpětně ze všech úkolů. 
  // To je ten instanční model. My to v dalším kroku nahradíme tvým 'data.allTags'.
  const allExistingTags = data ? Array.from(new Set(
    Object.values(data.tasks)
      .flatMap(task => task.tags || [])
      .map(tag => JSON.stringify(tag))
  )).map(t => JSON.parse(t) as Tag) : [];

  // --- [LIFECYCLE / EFEKTY] ---

  // 1. Aktivace dnd (Next.js specifické)
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  // 2. NAČTENÍ DAT (Při startu z prohlížeče)
  //useEffect(() => {
  //  const savedData = localStorage.getItem('vibe-kanban-data');
  //  if (savedData) {
  //    setData(JSON.parse(savedData));
  //  } else {
  //   setData(initialData);
  // }
  //}, []);


  // 3. UKLÁDÁNÍ DAT (Automaticky uloží vše při každé změně stavu 'data')
  //useEffect(() => {
  //  if (data) {
  //    localStorage.setItem('vibe-kanban-data', JSON.stringify(data));
  // }
  //}, [data]);

  // 1. NAČTENÍ DAT (Nahraď svůj starý useEffect pro načítání)

  useEffect(() => {
    // Zjistíme aktuálního uživatele při startu
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Posloucháme změny (přihlášení/odhlášení)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);


  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Jsme přihlášení - zkusíme cloud
        const { data: dbData } = await supabase
          .from('kanban_configs')
          .select('content')
          .single();

        if (dbData?.content) {
          setData(dbData.content);
          return; // Našli jsme v cloudu, končíme
        }
      }

      // Nejsme přihlášení NEBO v cloudu nic není - zkusíme LocalStorage
      const saved = localStorage.getItem('kanban-data');
      if (saved) {
        setData(JSON.parse(saved));
      } else {
        setData(initialData);
      }
    };

    if (enabled) loadData();
  }, [enabled]);

  // 2. UKLÁDÁNÍ DAT (Nahraď svůj starý useEffect pro ukládání)
  useEffect(() => {
    const saveData = async () => {
      if (!data) return;

      // 1. VŽDY uložíme do LocalStorage (pro offline/nepřihlášené)
      localStorage.setItem('kanban-data', JSON.stringify(data));

      // 2. POKUD jsme přihlášení, pošleme to i do Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase
          .from('kanban_configs')
          .upsert({
            user_id: session.user.id,
            content: data,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
      }
    };

    const timeoutId = setTimeout(saveData, 1000);
    return () => clearTimeout(timeoutId);
  }, [data]);

  const handleSignOut = async () => {
    // 1. Odhlášení ze Supabase (Google session)
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Chyba při odhlašování:", error.message);
      return;
    }

    // 2. Vyčištění stavu aplikace na výchozí hodnoty
    // (Předpokládám, že máš někde definované 'initialData' pro prázdný board)
    setData(initialData);

    // 3. Volitelné: Vyčištění LocalStorage, aby data nezůstala v prohlížeči
    localStorage.removeItem('kanban-data');

    // 4. Reset uživatele v aplikaci
    setUser(null);

    // Tip: reload stránky zajistí úplně čistý start
    window.location.reload();
  };

  // Bezpečnostní pojistka: Dokud se nenačtou data z localStorage, ukaž jen prázdnou tmu.
  if (!data) return <div className="bg-slate-900 min-h-screen" />;

  // --- FUNKCE PRO ÚKOLY ---
  const addTask = (columnId: string, text: string) => {
    // 1. KONTROLA PRÁZDNÉHO TEXTU
    // .trim() odstraní mezery. Pokud uživatel nic nenapsal, funkce skončí (return).
    if (!text.trim()) return;

    // 2. GENEROVÁNÍ ID
    const newTaskId = `task-${Date.now()}`;

    // 3. VYTVOŘENÍ OBJEKTU ÚKOLU
    const newTask: Todo = {
      id: newTaskId,
      text: text.replace(/!/g, ''), // Odstraní vykřičníky (tvůj speciální požadavek)
      priority: 'default',          // Každý nový úkol začíná jako 'default'
      tags: [],                     // Začíná bez štítků
      description: ''               // Prázdný popis
    };

    // 4. NAJITÍ SLOUPCE
    // Musíme vědět, do kterého sloupce (např. 'ideas') úkol přidáváme.
    const column = data.columns[columnId];

    // 5. ZÁPIS DO STAVU (State)
    setData({
      ...data, // Kopie všech dat
      tasks: {
        ...data.tasks,
        [newTaskId]: newTask // Přidáme úkol do celkového seznamu úkolů
      },
      columns: {
        ...data.columns,
        [columnId]: {
          ...column,
          taskIds: [...column.taskIds, newTaskId] // Přidáme ID úkolu na konec seznamu v daném sloupci
        }
      },
    });
  };

  const updateTaskDetail = (taskId: string, updates: Partial<Todo>) => {
    // 1. BEZPEČNOSTNÍ POJISTKA
    // Pokud náhodou data ještě nejsou načtená, nic nedělej.
    if (!data) return;

    // 2. VYTVOŘENÍ AKTUALIZOVANÉHO ÚKOLU
    // Vezmeme starou verzi úkolu: data.tasks[taskId]
    // A "přebijeme" ji novými daty: ...updates
    const updatedTask = { ...data.tasks[taskId], ...updates };

    // 3. PŘÍPRAVA NOVÉHO STAVU
    const newData = {
      ...data,
      tasks: {
        ...data.tasks,
        [taskId]: updatedTask // Do skladu úkolů uložíme tu novou, upravenou verzi
      }
    };

    // 4. ZÁPIS DO DATABÁZE (State)
    setData(newData);

    // 5. SYNCHRONIZACE POPUPU
    // Tohle je důležité! setEditingTask aktualizuje stav tvého otevřeného okna.
    // Kdyby tu tenhle řádek nebyl, změnil by se sice úkol na pozadí v kanbanu,
    // ale v tom otevřeném okně bys pořád viděl stará data.
    setEditingTask(prev => prev ? { ...prev, task: updatedTask } : null);
  };

  const deleteTask = (taskId: string, columnId: string) => {
    // 1. NAJITÍ SLOUPCE A ÚPRAVA JEHO SEZNAMU
    const column = data.columns[columnId];
    // Vytvoříme nový seznam IDček, ve kterém už není to smazané taskId
    const newTaskIds = column.taskIds.filter(id => id !== taskId);

    // 2. ODSTRANĚNÍ ÚKOLU ZE "SKLADU" (tasks)
    // Nejdřív uděláme kopii všech úkolů
    const newTasks = { ...data.tasks };
    // A pak z té kopie natvrdo smažeme ten jeden konkrétní úkol
    delete newTasks[taskId];

    // 3. ZÁPIS DO CELKOVÝCH DAT
    setData({
      ...data,
      tasks: newTasks, // Tady posíláme ten sklad bez smazaného úkolu
      columns: {
        ...data.columns,
        [columnId]: { ...column, taskIds: newTaskIds } // Tady aktualizovaný sloupec
      }
    });

    // 4. ZAVŘENÍ POPUPU (v1.1.1 fix)
    // Protože úkol už neexistuje, musíme vynulovat editingTask, 
    // jinak by se nám popup snažil zobrazit neexistující data a aplikace by spadla.
    setEditingTask(null);
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // 1. KONTROLA: Pustil jsi to mimo sloupec?
    if (!destination) return;

    // 2. KONTROLA: Pustil jsi to na stejné místo, kde to bylo?
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // 3. PŘÍPRAVA PROMĚNNÝCH
    const start = data.columns[source.droppableId];   // Sloupec, odkud úkol bereš
    const finish = data.columns[destination.droppableId]; // Sloupec, kam ho dáváš
    const task = data.tasks[draggableId];            // Samotný úkol, se kterým hýbeš

    // 4. LOGIKA PRO "DONE" SLOUPEC (v1.1.2)
    // Vytvoříme kopii úkolu, abychom mu mohli přidat/odebrat timestamp
    const updatedTask = { ...task };

    if (destination.droppableId === 'done' && source.droppableId !== 'done') {
      // Pokud jsi ho právě hodil do DONE
      updatedTask.completedAt = new Date().toISOString();
    } else if (destination.droppableId !== 'done' && source.droppableId === 'done') {
      // Pokud jsi ho z DONE vytáhl zpátky (třeba do Progress)
      delete updatedTask.completedAt;
    }

    // 5. PŘESUN V RÁMCI JEDNOHO SLOUPCE
    if (start === finish) {
      const newTaskIds = Array.from(start.taskIds); // Uděláme kopii seznamu IDček
      newTaskIds.splice(source.index, 1);           // Vyndáme ID ze staré pozice
      newTaskIds.splice(destination.index, 0, draggableId); // Vložíme ID na novou pozici

      setData({
        ...data,
        tasks: { ...data.tasks, [draggableId]: updatedTask }, // Uložíme úkol (kvůli completedAt)
        columns: {
          ...data.columns,
          [start.id]: { ...start, taskIds: newTaskIds }
        }
      });
      return;
    }

    // 6. PŘESUN MEZI RŮZNÝMI SLOUPCI
    // Musíme upravit dvě pole IDček: ve startovním sloupci a v cílovém sloupci
    const startTaskIds = Array.from(start.taskIds);
    startTaskIds.splice(source.index, 1); // Vyndat ze startu

    const finishTaskIds = Array.from(finish.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId); // Vložit do cíle

    setData({
      ...data,
      tasks: { ...data.tasks, [draggableId]: updatedTask },
      columns: {
        ...data.columns,
        [start.id]: { ...start, taskIds: startTaskIds },
        [finish.id]: { ...finish, taskIds: finishTaskIds },
      },
    });
  };

  const updateGlobalTags = (newTags: Tag[]) => {
    setData({
      ...data,
      allTags: newTags
    });
  };

  if (!enabled) return null;

  if (!user && !isAnonymous) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-lg w-full text-center space-y-8">
          <div>
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 tracking-tighter mb-4">
              WHAT TO DO
            </h1>
            <p className="text-slate-400 text-lg">
              Tvůj produktivní vesmír. Přihlas se a měj úkoly vždy po ruce!
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {/* Hlavní lákadlo: Google Login */}
            <button
              onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
              className="w-full bg-white text-black py-4 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform cursor-pointer"
            >
              <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="" />
              Přihlásit se přes Google
            </button>

            {/* Vedlejší cesta: Local Storage */}
            <button
              onClick={() => setIsAnonymous(true)}
              className="w-full bg-slate-900 text-slate-300 py-4 rounded-2xl font-medium hover:bg-slate-800 transition cursor-pointer border border-white/5"
            >
              Pokračovat bez přihlášení (pouze v prohlížeči)
            </button>
          </div>

          <p className="text-slate-600 text-xs">
            Bez přihlášení se data ukládají pouze do vašeho prohlížeče.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      {/* Kontejner, který drží šířku celého webu */}
      <div className="w-fit mx-auto">

        {/* Horní řádek s nadpisem a tlačítkem */}
        <div className="flex justify-between items-end mb-12 gap-4">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 tracking-tight leading-none">
            WHAT TO DO
          </h1>

          <div className="flex items-center gap-4 select-none">
            {user ? (
              <>
                <span className="text-slate-400 text-sm hidden sm:block">{user.email}</span>
                <button
                  type="button"
                  onClick={handleSignOut} // <--- Tady voláme naši novou funkci
                  className="text-white/50 hover:text-white border border-white/20 px-4 py-1.5 rounded-full text-xs transition cursor-pointer"
                >
                  Odhlásit se
                </button>
              </>
            ) : (
              <button
                onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
                className="bg-white text-black px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform cursor-pointer"
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="" />
                Přihlásit se
              </button>
            )}
          </div>
        </div>


        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-8 items-start">
            {data.columnOrder.map((columnId) => {
              const column = data.columns[columnId];
              const isDoneColumn = column.id === 'done';

              // Jednoduché mapování úkolů bez filtrů
              const tasks = column.taskIds.map((taskId) => data.tasks[taskId]);

              return (
                <div
                  key={column.id}
                  className={`w-80 min-h-[500px] rounded-3xl p-5 flex flex-col border shadow-2xl shrink-0 max-h-[80vh] transition-all
                      ${column.id === 'ideas'
                      ? 'bg-indigo-500/5 border-indigo-500/20 border-dashed'
                      : 'bg-slate-900/40 border-slate-800'}`}
                >


                  {/* ZÁHLAVÍ SLOUPCE */}
                  <div className="flex justify-between items-center mb-6 select-none">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-sm">
                      {column.title}
                    </span>
                  </div>

                  {/* DROPPABLE OBLAST */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        /* Tato vrstva nemá overflow, takže z ní karta může "vylétnout" ven */
                        className={`flex-1 flex flex-col min-h-0 ${snapshot.isDraggingOver ? 'bg-indigo-500/5' : ''}`}
                      >
                        {/* Tato vnitřní vrstva se stará o scroll a masku */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 select-none">
                          {tasks.map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    zIndex: snapshot.isDragging ? 9999 : 1,
                                  }}
                                  className="mb-3 outline-none"
                                  onClick={() => {
                                    if (!snapshot.isDragging) {
                                      setEditingTask({ task, colId: column.id });
                                    }
                                  }}
                                >
                                  {/* KARTA ÚKOLU */}
                                  <div
                                    className={`${STYLES.card} ${isDoneColumn
                                      ? 'bg-slate-900/20 opacity-50 grayscale border-none shadow-none'
                                      : snapshot.isDragging
                                        ? 'cursor-grabbing !scale-[1.02] !rotate-[1.5deg] shadow-2xl ring-2 ring-indigo-500'
                                        : 'cursor-pointer hover:border-indigo-500/50 hover:shadow-lg'
                                      }`}
                                  >
                                    {/* PRIORITA (Skryta v Done) */}
                                    {!isDoneColumn && task.priority !== 'none' && (
                                      <div className={`text-[12px] font-black uppercase mb-3 w-fit px-2 py-0.5 rounded border 
                                      ${task.priority === 'urgent'
                                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                          : task.priority === 'high'
                                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                                            : task.priority === 'default'
                                              ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                              : task.priority === 'nice to have'
                                                ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                                                : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                                        }`}
                                      >
                                        {task.priority}
                                      </div>
                                    )}

                                    {/* TEXT ÚKOLU*/}
                                    <div className={`text-[18px] font-semibold tracking-tight leading-snug break-words 
                                    ${isDoneColumn ? 'text-slate-500 line-through font-normal' : 'text-slate-200'}`}>
                                      {task.text}
                                    </div>

                                    {/* ANOTACE A ŠTÍTKY*/}
                                    {!isDoneColumn && (
                                      <>
                                        {task.description && (
                                          <div className="text-slate-500 text-[14px] mt-2 line-clamp-2 italic">
                                            {task.description}
                                          </div>
                                        )}
                                        <div className="flex flex-wrap gap-1.5 mt-4">
                                          {task.tags?.map((tag, i) => (
                                            <span key={i} className="text-[13px] px-1.5 py-0.5 rounded font-bold uppercase border"
                                              style={{ backgroundColor: tag.color + '11', color: tag.color, borderColor: tag.color + '33' }}>
                                              {tag.name}
                                            </span>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>

                  {/* INPUT PRO NOVÝ ÚKOL */}
                  <div className="mt-4 pt-4 border-t border-slate-800/50 select-none">
                    <input
                      type="text"
                      placeholder="+ Přidat úkol..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const target = e.target as HTMLInputElement;
                          addTask(column.id, target.value);
                          target.value = '';
                        }
                      }}
                      className="w-full bg-slate-950/30 p-3 rounded-xl text-sm border border-slate-800 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-700 hover:bg-slate-950/50"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {editingTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">

            {/* HLAVIČKA */}
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                DETAIL ÚKOLU
              </h2>
              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full"
              >
                ✕
              </button>
            </div>

            {/* NÁZEV ÚKOLU */}
            <div className="mb-6">
              <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest ml-1">Název</label>
              <input
                className="w-full bg-slate-800/50 border border-slate-700 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-white font-semibold transition-all"
                value={editingTask.task.text}
                onChange={(e) => updateTaskDetail(editingTask.task.id, { text: e.target.value })}
              />
            </div>

            {/* POPIS / ANOTACE */}
            <div className="mb-6">
              <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest ml-1">Popis / Anotace</label>
              <textarea
                rows={4}
                className="w-full bg-slate-800/50 border border-slate-700 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-300 text-sm resize-none transition-all"
                placeholder="Zde napiš podrobnosti k úkolu..."
                value={editingTask.task.description || ""}
                onChange={(e) => updateTaskDetail(editingTask.task.id, { description: e.target.value })}
              />
            </div>

            {/* PRIORITA */}
            <div className="mb-8">
              <label className="block text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest ml-1">Priorita</label>
              <div className="flex flex-wrap gap-2">
                {(['none', 'nice to have', 'default', 'high', 'urgent'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => updateTaskDetail(editingTask.task.id, { priority: p })}
                    className={`px-4 py-2 rounded-xl capitalize text-xs font-bold transition-all border ${editingTask.task.priority === p
                      ? (p === 'urgent' ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20' :
                        p === 'high' ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' :
                          p === 'default' ? 'bg-yellow-600 border-yellow-500 text-white shadow-lg shadow-yellow-600/20' :
                            p === 'nice to have' ? 'bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-600/20' :
                              'bg-slate-600 border-slate-500 text-white shadow-lg shadow-slate-600/20')
                      : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* ŠTÍTKY SEKCE */}
            <div className="mb-8">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block ml-1">
                Knihovna štítků
              </label>

              {/* 1. KNIHOVNA GLOBÁLNÍCH ŠTÍTKŮ */}
              <div className="flex flex-wrap gap-2 mb-4 p-4 bg-slate-950/40 rounded-2xl border border-slate-800 min-h-[60px]">
                {data.allTags?.map((tag, idx) => {
                  const isAlreadyOnTask = editingTask.task.tags.some(t => t.name === tag.name);
                  return (
                    <div key={idx} className="group relative">
                      <button
                        disabled={isAlreadyOnTask}
                        onClick={() => {
                          const newTags = [...editingTask.task.tags, tag];
                          updateTaskDetail(editingTask.task.id, { tags: newTags });
                        }}
                        style={{
                          // Barva pozadí: Pokud je vybraný, dáme mu jen velmi jemný nádech, jinak 22% průhlednost barvy
                          backgroundColor: isAlreadyOnTask ? `${tag.color}11` : `${tag.color}22`,
                          // Barva textu: Tady vynutíme barvu štítku i pro disabled stav
                          color: tag.color,
                          // Barva ohraničení: 44% průhlednost
                          borderColor: isAlreadyOnTask ? `${tag.color}33` : `${tag.color}44`
                        }}
                        className={`select-none cursor-pointer text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all uppercase ${isAlreadyOnTask
                          ? 'opacity-50 !cursor-not-allowed' // Snížíme jen sytost, ale barva zůstane
                          : 'hover:scale-105 active:scale-95 shadow-sm'
                          }`}
                      >
                        {isAlreadyOnTask ? `✓ ${tag.name.toUpperCase()}` : `+ ${tag.name.toUpperCase()}`}
                      </button>

                      {/* Tlačítko pro smazání z knihovny */}
                      <button
                        onClick={() => {
                          // 1. Odstraníme štítek z globální knihovny
                          const filteredGlobal = data.allTags.filter(t => t.name !== tag.name);

                          // 2. Projdeme VŠECHNY úkoly a z každého tenhle štítek vymažeme
                          const updatedTasks = { ...data.tasks };
                          Object.keys(updatedTasks).forEach(taskId => {
                            updatedTasks[taskId] = {
                              ...updatedTasks[taskId],
                              tags: updatedTasks[taskId].tags.filter(t => t.name !== tag.name)
                            };
                          });

                          // 3. Uložíme obojí naráz
                          setData({
                            ...data,
                            allTags: filteredGlobal,
                            tasks: updatedTasks
                          });

                          // 4. Pokud zrovna upravujeme úkol, který tenhle štítek měl, musíme ho aktualizovat i v popupu
                          if (editingTask) {
                            setEditingTask({
                              ...editingTask,
                              task: {
                                ...editingTask.task,
                                tags: editingTask.task.tags.filter(t => t.name !== tag.name)
                              }
                            });
                          }
                        }}
                        className="cursor-pointer absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
                {data.allTags.length === 0 && <p className="text-[10px] italic text-slate-600">Knihovna je prázdná...</p>}
              </div>

              {/* 2. AKTIVNÍ ŠTÍTKY ÚKOLU */}
              <div className="flex flex-wrap gap-2 mb-6">
                {editingTask.task.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    style={{ backgroundColor: `${tag.color}33`, color: tag.color, borderColor: `${tag.color}55` }}
                    className="text-[11px] font-extrabold px-3 py-1.5 rounded-lg border uppercase flex items-center gap-2"
                  >
                    {tag.name}
                    <button
                      onClick={() => {
                        const newTags = editingTask.task.tags.filter((_, i) => i !== idx);
                        updateTaskDetail(editingTask.task.id, { tags: newTags });
                      }}
                      className="cursor-pointer hover:text-white transition-colors"
                    >✕</button>
                  </span>
                ))}
              </div>

              {/* 3. PICKER A VYTVOŘENÍ */}
              <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700 flex items-center gap-3">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-none p-1"
                />
                <input
                  type="text"
                  placeholder="Název nového štítku..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm text-white font-bold"
                />
                <button
                  onClick={() => {
                    if (!newTagName.trim()) return;
                    const newTag = { name: newTagName.trim(), color: newTagColor };

                    // 1. Zjistíme, jestli už v knihovně náhodou není (ignorujeme velikost písmen)
                    const existsInGlobal = data.allTags.some(t => t.name.toLowerCase() === newTag.name.toLowerCase());

                    // 2. Aktualizujeme celá data naráz (Knihovnu i Úkol)
                    setData({
                      ...data,
                      allTags: existsInGlobal ? data.allTags : [...data.allTags, newTag],
                      tasks: {
                        ...data.tasks,
                        [editingTask.task.id]: {
                          ...editingTask.task,
                          tags: [...editingTask.task.tags, newTag]
                        }
                      }
                    });

                    // 3. Musíme aktualizovat i lokální stav okna, aby se štítek hned objevil v modré pilulce
                    setEditingTask({
                      ...editingTask,
                      task: {
                        ...editingTask.task,
                        tags: [...editingTask.task.tags, newTag]
                      }
                    });

                    setNewTagName(""); // Vyčistit input
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-600/20 uppercase"
                >
                  Vytvořit
                </button>
              </div>
            </div>

            {/* AKČNÍ TLAČÍTKA DOLE */}
            <div className="flex justify-between items-center gap-4 mt-8 pt-6 border-t border-slate-800">
              <button
                onClick={() => deleteTask(editingTask.task.id, editingTask.colId)}
                className="px-6 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all font-black text-[11px] uppercase tracking-widest"
              >
                Smazat úkol
              </button>

              <button
                onClick={() => setEditingTask(null)}
                className="px-10 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 transition-all font-black text-[11px] uppercase tracking-widest"
              >
                Uložit
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}