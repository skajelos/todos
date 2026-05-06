"use client";

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

// --- TYPY A POČÁTEČNÍ DATA ---
type Tag = { name: string; color: string };

type Todo = {
  id: string;
  text: string;
  description?: string;
  priority: 'none' | 'nice to have' | 'todo' | 'high' | 'urgent';
  tags: Tag[];
};
type Column = { id: string; title: string; taskIds: string[] };
type Data = {
  tasks: { [key: string]: Todo };
  columns: { [key: string]: Column };
  columnOrder: string[];
};

const initialData: Data = {
  tasks: {
    'task-1': {
      id: 'task-1',
      text: 'Vítej ve tvém planneru! 🌙',
      priority: 'none', // OPRAVENO
      tags: []
    }
  },
  columns: {
    'col-1': { id: 'col-1', title: 'To Do', taskIds: ['task-1'] },
    'col-2': { id: 'col-2', title: 'Hotovo', taskIds: [] },
  },
  columnOrder: ['col-1', 'col-2'],
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
      priority: 'todo', // Výchozí stav pro nové úkoly
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

    if (start === finish) {
      const newTaskIds = Array.from(start.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);
      setData({ ...data, columns: { ...data.columns, [start.id]: { ...start, taskIds: newTaskIds } } });
      return;
    }

    const startTaskIds = Array.from(start.taskIds);
    startTaskIds.splice(source.index, 1);
    const finishTaskIds = Array.from(finish.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);

    setData({
      ...data,
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
      <div className="max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-4">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 tracking-tighter italic">
            VIBE PLANNER 🌙
          </h1>
          <button
            onClick={addColumn}
            className="bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-2xl font-bold shadow-xl shadow-indigo-500/20 active:scale-95"
          >
            + Přidat sloupec
          </button>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-10 custom-scrollbar">
            {data.columnOrder.map((columnId) => {
              const column = data.columns[columnId];
              const tasks = column.taskIds.map((taskId) => data.tasks[taskId]);

              return (
                <div key={column.id} className="bg-slate-900/40 w-80 rounded-3xl p-5 flex flex-col border border-slate-800 shadow-2xl shrink-0 min-h-[500px]">
                  {/* Záhlaví sloupce */}
                  <div className="flex justify-between items-center mb-6 group/column">
                    <input
                      value={column.title}
                      onChange={(e) => renameColumn(column.id, e.target.value)}
                      className="bg-transparent border-none font-bold text-slate-400 focus:text-indigo-300 focus:outline-none uppercase tracking-widest text-xs"
                    />
                    <button
                      onClick={() => deleteColumn(column.id)}
                      className="text-slate-700 hover:text-red-500 opacity-0 group-hover/column:opacity-100 transition-opacity"
                    >✕</button>
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
                                  <div className={`text-[9px] font-black uppercase mb-2 w-fit px-2 py-0.5 rounded border ${task.priority === 'urgent' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                    task.priority === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                      task.priority === 'todo' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                        task.priority === 'nice to have' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                                          'bg-slate-500/20 text-slate-400 border-slate-500/30'
                                    }`}>
                                    {task.priority}
                                  </div>

                                  {/* TEXT ÚKOLU */}
                                  <div className="text-slate-200 font-semibold mb-2 tracking-tight leading-snug break-words">
                                    {task.text}
                                  </div>

                                  {/* ANOTACE (VRÁCENO) */}
                                  {task.description && (
                                    <div className="text-slate-500 text-[11px] mb-3 line-clamp-3 leading-relaxed pointer-events-none italic">
                                      {task.description}
                                    </div>
                                  )}

                                  {/* ŠTÍTKY (VRÁCENO) */}
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {task.tags?.map((tag, i) => (
                                      <span
                                        key={i}
                                        className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase"
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
              <button onClick={() => setEditingTask(null)} className="text-slate-500 hover:text-white">✕ Zavřít</button>
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
              {(['none', 'nice to have', 'todo', 'high', 'urgent'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => updateTaskDetail(editingTask.task.id, { priority: p })}
                  className={`px-3 py-1.5 rounded-lg capitalize text-xs font-bold transition-all border ${editingTask.task.priority === p
                    ? (p === 'urgent' ? 'bg-red-600 border-red-500 text-white' :
                      p === 'high' ? 'bg-orange-600 border-orange-500 text-white' :
                        p === 'todo' ? 'bg-yellow-600 border-yellow-500 text-white' :
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
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Štítky</label>
            <div className="flex flex-wrap gap-2 mb-6">
              {editingTask.task.tags?.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2"
                  style={{ backgroundColor: tag.color + '33', color: tag.color, border: `1px solid ${tag.color}44` }}
                >
                  {tag.name}
                  <button
                    onClick={() => {
                      const newTags = editingTask.task.tags.filter((_, i) => i !== idx);
                      updateTaskDetail(editingTask.task.id, { tags: newTags });
                    }}
                    className="hover:text-white"
                  >✕</button>
                </span>
              ))}
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
          </div>
        </div>
      )}
    </main>
  );
}