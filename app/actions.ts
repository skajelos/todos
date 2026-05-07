'use server' // Důležité! Říká, že tohle běží jen na serveru

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function getTasks() {
  const { data } = await supabase.from('tasks').select('*').order('created_at')
  return data || []
}

export async function addTask(formData: FormData) {
  const text = formData.get('taskText') as string
  
  await supabase.from('tasks').insert([{ 
    text, 
    status: 'TODO', 
    priority: 'DEFAULT' 
  }])

  revalidatePath('/') // Automaticky obnoví data na stránce
}

export async function deleteTask(id: string) {
  await supabase.from('tasks').delete().eq('id', id)
  revalidatePath('/')
}