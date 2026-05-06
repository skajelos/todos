"use client";

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

// --- TYPY A POČÁTEČNÍ DATA ---
type Tag = { name: string; color: string };

type Todo = {
  id: string;
  text: string;
  description?: string;
  priority: 'none' | 'nice to have' | 'default' | 'high' | 'urgent';
  tags: Tag[];
  completedAt?: string;
};
type Column = { id: string; title: string; taskIds: string[] };
type Data = {
  tasks: { [key: string]: Todo };
  columns: { [key: string]: Column };
  columnOrder: string[];
  allTags: Tag[];
};

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
  allTags: [
    { name: "BUG", color: "#ef4444" },
    { name: "FEATURE", color: "#3b82f6" },
    { name: "DESIGN", color: "#ec4899" }
  ],
};

const STYLES = {
  card: "group bg-slate-800/90 p-4 rounded-2xl mb-3 border border-slate-700/50 hover:border-indigo-500/50 transition-all shadow-lg relative",
  column: "bg-slate-900/50 backdrop-blur-xl w-85 rounded-3xl p-5 flex flex-col border border-slate-800 shadow-2xl shrink-0",
  input: "w-full bg-slate-950/40 p-4 rounded-xl text-sm border border-slate-800 focus:border-indigo-500/50 outline-none transition-all"

};

export default function Kanban() {
  const [data, setData] = useState<Data | null>(null); // Startujeme s null kvůli hydrataci
  const [newTaskText, setNewTaskText] = useState("");
  const [editingTask, setEditingTask] = useState<{ task: Todo, colId: string } | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  // Fix pro Next.js Strict Mode a dnd
  const [enabled, setEnabled] = useState(false);
  const allExistingTags = data ? Array.from(new Set(
    Object.values(data.tasks)
      .flatMap(task => task.tags || [])
      .map(tag => JSON.stringify(tag)) // Hack, aby Set poznal unikátní objekty
  )).map(t => JSON.parse(t) as Tag) : [];
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);


  // 1. NAČTENÍ DAT (Při startu)
  useEffect(() => {
    const savedData = localStorage.getItem('vibe-kanban-data');
    if (savedData) {
      setData(JSON.parse(savedData));
    } else {
      setData(initialData);
    }
  }, []);

  // 2. UKLÁDÁNÍ DAT (Při každé změně)
  useEffect(() => {
    if (data) {
      localStorage.setItem('vibe-kanban-data', JSON.stringify(data));
    }
  }, [data]);

  if (!data) return <div className="bg-slate-900 min-h-screen" />; // Prevence problému při načítání

  // --- FUNKCE PRO SLOUPCE ---
  const addColumn = () => {
    const newColumnId = `col-${Date.now()}`;
    const newColumn: Column = { id: newColumnId, title: 'Nový sloupec', taskIds: [] };
    setData({
      ...data,
      columns: { ...data.columns, [newColumnId]: newColumn },
      columnOrder: [...data.columnOrder, newColumnId],
    });
  };

  const deleteColumn = (columnId: string) => {
    const newColumnOrder = data.columnOrder.filter(id => id !== columnId);
    const newColumns = { ...data.columns };
    delete newColumns[columnId];
    setData({ ...data, columns: newColumns, columnOrder: newColumnOrder });
  };

  const renameColumn = (columnId: string, newTitle: string) => {
    const column = data.columns[columnId];
    const newColumn = { ...column, title: newTitle };
    setData({ ...data, columns: { ...data.columns, [columnId]: newColumn } });
  };

  // --- FUNKCE PRO ÚKOLY ---
  const addTask = (columnId: string, text: string) => {
    if (!text.trim()) return;
    const newTaskId = `task-${Date.now()}`;

    const newTask: Todo = {
      id: newTaskId,
      text: text.replace(/!/g, ''),
      priority: 'default', // Výchozí stav pro nové úkoly
      tags: [],
      description: ''
    };
    const column = data.columns[columnId];

    setData({
      ...data,
      tasks: { ...data.tasks, [newTaskId]: newTask },
      columns: { ...data.columns, [columnId]: { ...column, taskIds: [...column.taskIds, newTaskId] } },
    });
  };

  const updateTaskDetail = (taskId: string, updates: Partial<Todo>) => {
    if (!data) return;
    const updatedTask = { ...data.tasks[taskId], ...updates };
    const newData = {
      ...data,
      tasks: { ...data.tasks, [taskId]: updatedTask }
    };
    setData(newData);
    // Aktualizujeme i stav otevřeného okna, aby se změna hned projevila
    setEditingTask(prev => prev ? { ...prev, task: updatedTask } : null);
  };

  const deleteTask = (taskId: string, columnId: string) => {
    const column = data.columns[columnId];
    const newTaskIds = column.taskIds.filter(id => id !== taskId);
    const newTasks = { ...data.tasks };
    delete newTasks[taskId];

    setData({
      ...data,
      tasks: newTasks,
      columns: { ...data.columns, [columnId]: { ...column, taskIds: newTaskIds } }
    });

    setEditingTask(null);
  };

  

  const updateTaskText = (taskId: string, newText: string) => {
    if (!data) return;
    const newTask = { ...data.tasks[taskId], text: newText };
    setData({
      ...data,
      tasks: { ...data.tasks, [taskId]: newTask }
    });
  };


  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const start = data.columns[source.droppableId];
    const finish = data.columns[destination.droppableId];

    // --- TADY JE TA ZMĚNA ---
    // Pokud úkol skončí v DONE, přidáme mu datum. Pokud ho z DONE vytáhneme, datum smažeme.
    const task = data.tasks[draggableId];
    const updatedTask = { ...task };

    if (destination.droppableId === 'done' && source.droppableId !== 'done') {
      updatedTask.completedAt = new Date().toISOString();
    } else if (destination.droppableId !== 'done' && source.droppableId === 'done') {
      delete updatedTask.completedAt;
    }

    if (start === finish) {
      const newTaskIds = Array.from(start.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);
      setData({
        ...data,
        tasks: { ...data.tasks, [draggableId]: updatedTask }, // Uložíme případnou změnu data
        columns: { ...data.columns, [start.id]: { ...start, taskIds: newTaskIds } }
      });
      return;
    }

    const startTaskIds = Array.from(start.taskIds);
    startTaskIds.splice(source.index, 1);
    const finishTaskIds = Array.from(finish.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);

    setData({
      ...data,
      tasks: { ...data.tasks, [draggableId]: updatedTask }, // Uložíme případnou změnu data
      columns: {
        ...data.columns,
        [start.id]: { ...start, taskIds: startTaskIds },
        [finish.id]: { ...finish, taskIds: finishTaskIds },
      },
    });
  };

  if (!enabled) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="w-full px-2 md:px-30">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-4">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 tracking-tighter italic">
            WHAT TO DO?!
          </h1>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-8 no-scrollbar snap-x cursor-grab active:cursor-grabbing select-none">
            {data.columnOrder.map((columnId) => {
              const column = data.columns[columnId];
              let tasks = column.taskIds.map((taskId) => data.tasks[taskId]);

              // Pokud jde o sloupec DONE, filtrujeme úkoly starší než 7 dní
              if (column.id === 'done') {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                tasks = tasks.filter(task => {
                  if (!task.completedAt) return true; // Pokud nemá datum, necháme ho tam
                  return new Date(task.completedAt) > sevenDaysAgo;
                });
              }

              return (<div
                key={column.id}
                className={`w-80 rounded-3xl p-5 flex flex-col border shadow-2xl shrink-0 min-h-[500px] transition-all
    ${column.id === 'ideas'
                    ? 'bg-indigo-500/5 border-indigo-500/20 border-dashed'
                    : 'bg-slate-900/40 border-slate-800'
                  }`}
              >

                {/* Záhlaví sloupce */}
                <div className="flex justify-between items-center mb-6 group/column">
                  <input
                    value={column.title}
                    onChange={(e) => renameColumn(column.id, e.target.value)}
                    className="bg-transparent border-none font-bold text-slate-400 focus:text-indigo-300 focus:outline-none uppercase tracking-widest text-xs"
                  />

                </div>

                {/* DROPPABLE OBLAST */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 flex flex-col min-h-[150px] transition-colors duration-200 rounded-2xl ${snapshot.isDraggingOver ? 'bg-indigo-500/5' : ''
                        }`}
                    >
                      {tasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => {
                                if (!snapshot.isDragging) {
                                  setEditingTask({ task, colId: column.id });
                                }
                              }}
                              style={{
                                ...provided.draggableProps.style,
                                zIndex: snapshot.isDragging ? 9999 : 1,
                                // FIX: Vynutíme, aby dnd neovlivňovalo pozici pomocí transformu, pokud to dělá neplechu, 
                                // ale u hello-pangea/dnd je lepší nechat transform na pokoji a opravit vnitřek.
                              }}
                              className={`mb-3 outline-none ${snapshot.isDragging ? 'z-[9999]' : ''}`}
                            >
                              <div
                                className={`${STYLES.card} ${snapshot.isDragging
                                  ? 'cursor-grabbing !scale-[1.02] !rotate-[1.5deg] shadow-2xl ring-2 ring-indigo-500'
                                  : 'cursor-grab hover:border-indigo-500/50 hover:shadow-lg active:cursor-grabbing'

                                  }`}
                                style={{
                                  transition: snapshot.isDragging
                                    ? 'none'
                                    : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease, border-color 0.2s ease',
                                }}
                              >
                                {/* PRIORITA */}
                                <div className={`text-[11px] font-black uppercase mb-4 w-fit px-2 py-0.5 rounded border ${task.priority === 'urgent' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                  task.priority === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                    task.priority === 'default' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                      task.priority === 'nice to have' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                                        'bg-slate-500/20 text-slate-400 border-slate-500/30'
                                  }`}>
                                  {task.priority}
                                </div>

                                {/* TEXT ÚKOLU */}
                                <div className="text-[18px] text-slate-200 font-semibold mb-3 tracking-tight leading-snug break-words">
                                  {task.text}
                                </div>

                                {/* ANOTACE */}
                                {task.description && (
                                  <div className="text-slate-500 text-[14px] mb-3 line-clamp-3 leading-relaxed pointer-events-none italic">
                                    {task.description}
                                  </div>
                                )}

                                {/* ŠTÍTKY */}
                                <div className="flex flex-wrap gap-1.5 mt-5">
                                  {task.tags?.map((tag, i) => (
                                    <span
                                      key={i}
                                      className="text-[12px] px-1.5 py-0.5 rounded font-bold uppercase"
                                      style={{
                                        backgroundColor: tag.color + '22',
                                        color: tag.color,
                                        border: `1px solid ${tag.color}44`
                                      }}
                                    >
                                      {tag.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Input pro nový úkol */}
                <div className="mt-4 pt-4 border-t border-slate-800/50">
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
                    className="w-full bg-slate-950/30 p-3 rounded-xl text-xs border border-slate-800 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-700 hover:bg-slate-950/50"
                  />
                </div>
              </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {editingTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-bold text-indigo-400">Detail úkolu</h2>
            </div>

            {/* Název úkolu */}
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Název</label>
            <input
              className="w-full bg-slate-800 p-3 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-indigo-500"
              value={editingTask.task.text}
              onChange={(e) => updateTaskDetail(editingTask.task.id, { text: e.target.value })}
            />

            {/* Anotace v detailu */}
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Popis / Anotace</label>
            <textarea
              rows={5}
              className="w-full bg-slate-800 p-3 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-200 text-sm resize-none"
              placeholder="Zde napiš podrobnosti k úkolu..."
              value={editingTask.task.description || ""}
              onChange={(e) => updateTaskDetail(editingTask.task.id, { description: e.target.value })}
            />

            {/* Priorita v detailu */}
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Priorita</label>
            <div className="flex flex-wrap gap-2 mb-6">
              {(['none', 'nice to have', 'default', 'high', 'urgent'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => updateTaskDetail(editingTask.task.id, { priority: p })}
                  className={`px-3 py-1.5 rounded-lg capitalize text-xs font-bold transition-all border ${editingTask.task.priority === p
                    ? (p === 'urgent' ? 'bg-red-600 border-red-500 text-white' :
                      p === 'high' ? 'bg-orange-600 border-orange-500 text-white' :
                        p === 'default' ? 'bg-yellow-600 border-yellow-500 text-white' :
                          p === 'nice to have' ? 'bg-sky-600 border-sky-500 text-white' :
                            'bg-slate-600 border-slate-500 text-white')
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Štítky */}
            <div className="mb-6">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 block ml-1">Štítky</label>

              {/* 1. KNIHOVNA EXISTUJÍCÍCH ŠTÍTKŮ */}
              <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-800/30 rounded-2xl border border-slate-800/50">
                <span className="text-[9px] text-slate-500 w-full mb-1 ml-1 font-bold">Dostupné:</span>
                {allExistingTags.length > 0 ? allExistingTags.map((tag, idx) => {
                  // Kontrola, jestli už úkol tento štítek má
                  const isAlreadyAdded = editingTask.task.tags.some(t => t.name === tag.name);

                  return (
                    <button
                      key={idx}
                      disabled={isAlreadyAdded}
                      onClick={() => {
                        const up = { ...editingTask.task, tags: [...editingTask.task.tags, tag] };
                        // Tady používáme tvůj live-edit přístup
                        setData({ ...data!, tasks: { ...data!.tasks, [editingTask.task.id]: up } });
                        setEditingTask({ ...editingTask, task: up });
                      }}
                      style={{ backgroundColor: isAlreadyAdded ? '#1e293b' : `${tag.color}22`, color: isAlreadyAdded ? '#475569' : tag.color }}
                      className={`text-[11px] font-bold px-3 py-1 rounded-lg border transition-all ${isAlreadyAdded ? 'border-slate-800 opacity-50' : 'border-current hover:scale-105 active:scale-95'}`}
                    >
                      {isAlreadyAdded ? `✓ ${tag.name}` : `+ ${tag.name}`}
                    </button>
                  );
                }) : <p className="text-[10px] italic text-slate-600 px-2">Zatím žádné štítky...</p>}
              </div>

              {/* 2. ZOBRAZENÍ AKTUÁLNÍCH ŠTÍTKŮ ÚKOLU (S možností smazat) */}
              <div className="flex flex-wrap gap-2">
                {editingTask.task.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    style={{ backgroundColor: `${tag.color}33`, color: tag.color, borderColor: `${tag.color}55` }}
                    className="text-[11px] font-extrabold px-2.5 py-1 rounded-md border uppercase flex items-center gap-2"
                  >
                    {tag.name}
                    <button
                      onClick={() => {
                        const up = { ...editingTask.task, tags: editingTask.task.tags.filter((_, i) => i !== idx) };
                        setData({ ...data!, tasks: { ...data!.tasks, [editingTask.task.id]: up } });
                        setEditingTask({ ...editingTask, task: up });
                      }}
                      className="hover:text-white"
                    >✕</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Picker pro nový štítek */}
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none"
              />
              <input
                type="text"
                placeholder="Název štítku..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm text-slate-200"
              />
              <button
                onClick={() => {
                  if (!newTagName) return;
                  const newTags = [...(editingTask.task.tags || []), { name: newTagName, color: newTagColor }];
                  updateTaskDetail(editingTask.task.id, { tags: newTags });
                  setNewTagName(""); // Vyčistit po přidání
                }}
                className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded-lg text-xs font-bold transition-colors"
              >
                Přidat
              </button>
            </div>

            <div className="flex justify-between items-center gap-4 mt-8 pt-6 border-t border-slate-800">
              {/* Tlačítko SMAZAT - jen zavolá tvoji existující funkci */}
              <button
                onClick={() => {
                  // Tady voláme tvou existující funkci. 
                  // Ujisti se, že předáváš správné ID (task.id a colId)
                  deleteTask(editingTask.task.id, editingTask.colId);
                }}
                className="px-5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all font-bold text-xs uppercase tracking-wider"
              >
                Smazat úkol
              </button>

              {/* Tlačítko HOTOVO - jen zavře okno, protože změny se ti ukládají průběžně */}
              <button
                onClick={() => setEditingTask(null)}
                className="px-8 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all font-bold text-xs uppercase tracking-wider"
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