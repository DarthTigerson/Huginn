import { create } from 'zustand'

interface GitLogStore {
  text: string
  append: (chunk: string) => void
}

export const useGitLogStore = create<GitLogStore>((set) => ({
  text: '',
  append: (chunk) => set((s) => ({ text: s.text + chunk })),
}))
