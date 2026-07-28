import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ShieldCheck, Activity, Database } from 'lucide-react'
import { useAuth } from './AuthContext'
import { LoginPage } from './LoginPage'
import { NavBar } from './NavBar'
import { ChatConsole } from './ChatConsole'
import { AuditTrail } from './AuditTrail'
import { DatabaseViewer } from './DatabaseViewer'
import { Certificate } from './Certificate'

type Tab = 'chat' | 'audit' | 'database'

const AUDIT_ROLES = new Set(['compliance_officer', 'reviewer'])

function AppContent() {
  const { user } = useAuth()
  const canViewAudit = !!user && AUDIT_ROLES.has(user.role)
  const [activeTab, setActiveTab] = useState<Tab>('chat')

  const showTab = canViewAudit ? activeTab : 'chat'

  return (
    // 1. Full page application (100dvh) with overflow hidden
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#F4F7FB] font-body selection:bg-blue-200 selection:text-blue-900">
      {/* 2. Fixed Navbar (shrink-0 prevents it from squishing) */}
      <div className="shrink-0">
        <NavBar />
      </div>

      {/* 3. Workspace Header with auto height (shrink-0) */}
      <div className="shrink-0 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl z-40">
        {/* Responsive width up to 1600px */}
        <div className="mx-auto flex w-full max-w-[1600px] flex-col px-4 lg:px-8">
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 lg:text-2xl">
                AI Governance Workspace
              </h1>
              <p className="mt-1 text-xs font-medium text-slate-500 lg:text-sm">
                Every AI conversation is securely verified and audit-ready.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm lg:text-sm">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Live Protection Active
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('chat')}
              className={`relative pb-3 text-sm font-semibold transition-colors ${
                showTab === 'chat'
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Chat Console
              </div>
              {showTab === 'chat' && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-blue-600" />
              )}
            </button>
            {canViewAudit ? (
              <button
                onClick={() => setActiveTab('audit')}
                className={`relative pb-3 text-sm font-semibold transition-colors ${
                  showTab === 'audit'
                    ? 'text-blue-600'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Audit Trail
                </div>
                {showTab === 'audit' && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-blue-600" />
                )}
              </button>
            ) : (
              <p className="ml-auto pb-3 text-xs font-medium text-slate-400">
                Audit Trail restricted to Compliance Officers
              </p>
            )}
            {canViewAudit && (
              <button
                onClick={() => setActiveTab('database')}
                className={`relative pb-3 text-sm font-semibold transition-colors ${
                  showTab === 'database'
                    ? 'text-blue-600'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Database
                </div>
                {showTab === 'database' && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-blue-600" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Main Container expands to fill remaining space (flex-1 min-h-0) */}
      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col p-3 md:p-4 lg:p-6">
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
            showTab === 'chat' ? '' : 'hidden'
          }`}
        >
          <ChatConsole />
        </div>

        {canViewAudit && showTab === 'audit' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <AuditTrail />
          </div>
        )}

        {canViewAudit && showTab === 'database' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DatabaseViewer />
          </div>
        )}
      </main>
    </div>
  )
}

function App() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/certificate/:response_id" element={<Certificate />} />
    </Routes>
  )
}

export default App