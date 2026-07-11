import { Sidebar } from './components/Sidebar/Sidebar'

export default function App() {
  return (
    <div className="w-screen h-screen bg-panel flex">
      <div className="w-64 shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Editor placeholder
      </div>
    </div>
  )
}
