import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { UIProvider } from '@/context/UIContext'
import { MonitorProvider } from '@/context/MonitorContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <UIProvider>
    <MonitorProvider>
      <RouterProvider router={router} />
    </MonitorProvider>
  </UIProvider>
)
