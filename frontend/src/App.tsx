import {

     Chart as ChartJS,

     CategoryScale,

     LinearScale,

     PointElement,

     LineElement,

     Tooltip,

     Legend,

     Filler,

} from 'chart.js'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { Line } from 'react-chartjs-2'


import {

     Link,

     Navigate,

     NavLink,

     Outlet,

     Route,

     Routes,

     useNavigate,

} from 'react-router-dom'

import './App.css'

ChartJS.register(

     CategoryScale,

     LinearScale,

     PointElement,

     LineElement,

     Tooltip,

     Legend,

     Filler,

)

const demoTenant = {

     id: 'org_acme_001',

     name: 'Acme Technologies',

     plan: 'Enterprise Plan',

}
type DemoProfile = {
  name: string
  email: string
  organization: string
}

function getDemoProfile(): DemoProfile {
  try {
    const saved = sessionStorage.getItem('ledgerguard-auth-user')
    if (saved) {
      const user = JSON.parse(saved)
      return {
        name: user.name || user.fullName || user.email || 'Workspace user',
        email: user.email || '',
        organization: user.organizationId || 'Workspace',
      }
    }
  } catch {
    // Invalid saved profile; use the fallback.
  }

  return {
    name: 'Workspace user',
    email: '',
    organization: 'Workspace',
  }
}


const nav = [

     { to: '/', label: 'Overview', icon: '▦', end: true },

     { to: '/ledger', label: 'Billing ledger', icon: '▤' },

     { to: '/transactions', label: 'Transactions', icon: '⇄' },

     { to: '/analytics', label: 'Analytics', icon: '▥' },

     { to: '/settings', label: 'Settings', icon: '⚙' },

]

function Login() {

     const go = useNavigate()

     const [org, setOrg] = useState('org_abhishek_test')

     const [email, setEmail] = useState('admin@test.ledgerguard.local')

     const [password, setPassword] = useState('')

     const [show, setShow] = useState(false)

     const [loading, setLoading] = useState(false)

     const [error, setError] = useState('')

     async function submit(e: FormEvent<HTMLFormElement>) {
       e.preventDefault()
       setError('')

       const organizationId = org.trim()
       const normalizedEmail = email.trim().toLowerCase()

       if (!organizationId || !normalizedEmail || !password) {
         setError('Please complete all fields.')
         return
       }

       if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
         setError('Enter a valid email address.')
         return
       }

       setLoading(true)

       try {
         const response = await fetch('/api/v1/auth/login', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'x-tenant-id': organizationId,
           },
           body: JSON.stringify({
             email: normalizedEmail,
             password,
           }),
         })

         const payload = await response.json().catch(() => ({}))
         const result = payload.data ?? payload

         if (!response.ok || payload.success === false) {
           throw new Error(payload.message || 'Login failed. Check your details.')
         }

         const token = result.token || payload.token
         const user = result.user || payload.user

         if (!token || !user) {
           throw new Error('The server response did not contain a login session.')
         }

         sessionStorage.setItem('ledgerguard-auth-token', token)
         sessionStorage.setItem('ledgerguard-auth-user', JSON.stringify(user))
         go('/')
       } catch (err) {
         setError(err instanceof Error ? err.message : 'Unable to connect to the server.')
       } finally {
         setLoading(false)
       }
     }

     return (

       <div className="login-page">

         <div className="brand">

           <b className="brand-mark">L</b>ledger<span>guard</span>

         </div>

         <div className="login-layout">

           <section className="login-story">

             <div className="kicker"><i /> BILLING INFRASTRUCTURE, REIMAGINED</div>

             <h1>Clarity in every<br /><em>transaction.</em></h1>

             <p>

               One intelligent workspace to manage billing, monitor usage, and

               understand your business — across every organization.

             </p>

             <div className="story-stats">

               <div><b>99.9%</b><small>Platform reliability</small></div>

               <div><b>Real-time</b><small>Billing visibility</small></div>

               <div><b>Multi-tenant</b><small>By design</small></div>

             </div>

             <div className="orb"><span>L</span></div>

           </section>

           <form className="login-card" onSubmit={submit}>

             <div className="login-icon">↗</div>

             <div className="kicker">WELCOME BACK</div>

             <h2>Sign in to your workspace</h2>

             <p className="muted">Enter your details to access your billing dashboard.</p>

             <label htmlFor="org">Organization ID</label>

             <input

id="org"

value={org}

onChange={(e) => setOrg(e.target.value)}

placeholder="org_your_company"

             />

             <label htmlFor="email">Work email</label>

             <input

id="email"

type="email"

value={email}

onChange={(e) => setEmail(e.target.value)}

placeholder="you@company.com"

             />

             <div className="label-line">

               <label htmlFor="password">Password</label>

               <button

className="link-button"

type="button"

onClick={() => setError('Password reset will be available after backend authentication is connected.')}

               >

                 Forgot password?

               </button>

             </div>

             <div className="password-row">

               <input

id="password"

type={show ? 'text' : 'password'}

value={password}

onChange={(e) => setPassword(e.target.value)}

placeholder="Enter your password"

               />

               <button type="button" onClick={() => setShow(!show)}>

                 {show ? 'Hide' : 'Show'}

               </button>

             </div>

             {error && <div className="error" role="alert">{error}</div>}

             <button className="primary full" disabled={loading}>

               {loading ? 'Signing in...' : 'Sign in to dashboard'} <span>→</span>

             </button>

             <div className="demo-note">

               Your credentials will be verified securely by the LedgerGuard backend.

             </div>

             <div className="signup-link">

               New to LedgerGuard? <Link to="/signup">Create an account</Link>

             </div>

           </form>

         </div>

         <footer className="login-footer">

           © 2026 LedgerGuard · Built for confident billing

         </footer>

       </div>

     )

}



function Signup() {
  return (
    <div className="login-page">
      <div className="brand">
        <b className="brand-mark">L</b>ledger<span>guard</span>
      </div>
      <div className="login-card">
        <div className="login-icon">＋</div>
        <div className="kicker">WORKSPACE ACCESS</div>
        <h2>Account creation is managed by your administrator</h2>
        <p className="muted">
          Public registration is disabled. Ask your workspace administrator
          to create an account for you, then sign in with your organization ID.
        </p>
        <div className="signup-link">
          <Link to="/login">Return to sign in</Link>
        </div>
      </div>
    </div>
  )
}
type NotificationItem = {
  id: number
  title: string
  message: string
  time: string
  read: boolean
  type: string
}

function Shell() {
  const profile = getDemoProfile()
    const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem('ledgerguard-notifications')

    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        localStorage.removeItem('ledgerguard-notifications')
      }
    }

    return [
      {
        id: 1,
        title: 'Billing report is ready',
        message: 'Your latest billing summary is available.',
        time: 'Just now',
        read: false,
        type: 'billing',
      },
      {
        id: 2,
        title: 'Transaction monitoring active',
        message: 'Transaction monitoring is running normally.',
        time: 'Today',
        read: false,
        type: 'system',
      },
      {
        id: 3,
        title: 'Workspace security update',
        message: 'Your workspace session is authenticated.',
        time: 'Today',
        read: true,
        type: 'security',
      },
    ]
  })

  const [notificationOpen, setNotificationOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(
      'ledgerguard-notifications',
      JSON.stringify(notifications)
    )
  }, [notifications])

  const unreadCount = notifications.filter((item) => !item.read).length

  function markNotificationRead(id: number) {
    setNotifications((items) =>
      items.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    )
  }

  function markAllNotificationsRead() {
    setNotifications((items) =>
      items.map((item) => ({ ...item, read: true }))
    )
  }

  function clearNotifications() {
    setNotifications([])
  }

     const go = useNavigate()

     function logout() {

       sessionStorage.removeItem('ledgerguard-auth-token')
       sessionStorage.removeItem('ledgerguard-auth-user')
       go('/login')

     }

     return (

       <div className="shell">

         <aside className="sidebar">

           <div className="brand">

             <b className="brand-mark">L</b>

             <span className="brand-word">ledger<span>guard</span></span>

           </div>

           <div className="side-label">WORKSPACE</div>

           <div className="tenant">

             <b>AT</b>

             <span>

               <strong>{profile.organization}</strong>

               <small>Workspace</small>

             </span>

             <i>⌄</i>

           </div>

           <nav>

             {nav.map((n) => (

               <NavLink key={n.to} to={n.to} end={n.end}>

                 <span>{n.icon}</span>{n.label}

               </NavLink>

             ))}

           </nav>

           <div className="side-bottom">

             <div className="help">

               <b>Need a hand?</b>

               <p>Visit our help center for support.</p>

               <button onClick={() => window.alert('Help center is a demo placeholder.')}>

                 Visit help center ↗

               </button>

             </div>

             <div className="profile">

               <b>
                 {profile.name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase()
                   .slice(0, 2)}
                </b>

               <span>

               <strong>{profile.name}</strong>  

                 <small>Workspace admin</small>

               </span>

               <button onClick={logout} aria-label="Log out">↗</button>

             </div>

           </div>

         </aside>

         <main className="main">

           <header className="topbar">

             <span>Workspace <i>/</i> <b>LedgerGuard</b></span>

            <div className="topbar-actions">
  <label className="demo-pill">● Authenticated session</label>

  <div className="notification-wrap">
    <button
      className="notification-trigger"
      type="button"
      aria-label={`Notifications: ${unreadCount} unread`}
      aria-expanded={notificationOpen}
      onClick={() => setNotificationOpen((open) => !open)}
    >
      🔔
      {unreadCount > 0 && (
        <span className="notification-count">{unreadCount}</span>
      )}
    </button>

    {notificationOpen && (
      <section className="notification-panel">
        <div className="notification-panel-head">
          <div>
            <strong>Notifications</strong>
            <small>{unreadCount} unread · Sample activity</small>
          </div>
          <button
            type="button"
            onClick={markAllNotificationsRead}
            disabled={unreadCount === 0}
          >
            Mark all read
          </button>
        </div>

        {notifications.length > 0 ? (
          <ul className="notification-list">
            {notifications.map((item) => (
              <li key={item.id} className={item.read ? 'is-read' : 'is-unread'}>
                <button
                  type="button"
                  className="notification-item"
                  onClick={() => markNotificationRead(item.id)}
                >
                  <span className="notification-dot" />
                  <span className="notification-copy">
                    <strong>{item.title}</strong>
                    <small>{item.message}</small>
                    <time>{item.time}</time>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="notification-empty">
            You're all caught up!
          </div>
        )}

        {notifications.length > 0 && (
          <div className="notification-panel-foot">
            <button type="button" onClick={clearNotifications}>
              Clear all
            </button>
          </div>
        )}
      </section>
    )}
  </div>

  <span className="avatar">AS</span>
</div> 
           </header>

           <div className="content"><Outlet /></div>

           <footer className="footer">

             <span>© 2026 LedgerGuard</span>

             <span>Secure billing infrastructure · Illustrative demo data</span>

           </footer>

         </main>

       </div>

     )

}

function Heading({

eyebrow,

title,

subtitle,

action,

}: {

     eyebrow: string

     title: string

     subtitle: string

     action?: string

}) {

     return (

       <div className="page-heading">

         <div>

           <div className="kicker">{eyebrow}</div>

           <h1>{title}</h1>

           <p>{subtitle}</p>

         </div>

         {action && (

           <button

className="secondary"

onClick={() => window.alert('Export will be connected to the backend later.')}

           >

             ↓ {action}

           </button>

         )}

       </div>

     )

}

function Stat({
  label,
  value,
  change,
  icon,
  comparison = 'vs last month',
}: {
  label: string
  value: string
  change: string
  icon: string
  comparison?: string
}) {
  return (
    <article className="stat">
      <div className="stat-top"><span>{label}</span><b>{icon}</b></div>
      <strong>{value}</strong>
      <small>
        <em>{comparison === 'vs last month' ? '↗ ' : ''}{change}</em>
        {comparison ? ` ${comparison}` : ''}
      </small>
    </article>
  )
}


type MonthlyRevenue = {
  month: string
  monthKey: string
  revenueMinor: number
}

function Revenue() {
  const [months, setMonths] = useState<MonthlyRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadRevenue() {
      try {
        const { apiRequest } = await import('./services/api')
        const result = await apiRequest<{
          months: MonthlyRevenue[]
        }>('/analytics/revenue/monthly')

        if (!cancelled) {
          setMonths(result.months)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load monthly revenue.'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRevenue()

    return () => {
      cancelled = true
    }
  }, [])

  const maxRevenue = Math.max(
    1,
    ...months.map((item) => item.revenueMinor)
  )

  const formatRevenue = (amountMinor: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amountMinor / 100)

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>Revenue overview</h3>
          <p>Actual monthly revenue · last 6 months</p>
        </div>
        <span className="legend">● Revenue</span>
      </div>

      {loading ? (
        <p className="empty">Loading monthly revenue...</p>
      ) : error ? (
        <p className="empty">{error}</p>
      ) : (
        <div className="bars">
          {months.map((item) => (
            <div className="bar-col" key={item.monthKey}>
              <small>{formatRevenue(item.revenueMinor)}</small>
              <div className="bar-track">
                <i
                  style={{
                    height: `${Math.max(
                      item.revenueMinor > 0 ? 8 : 0,
                      (item.revenueMinor / maxRevenue) * 100
                    )}%`,
                  }}
                />
              </div>
              <label>{item.month}</label>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function AnalyticsRevenue() {

     const data = {

       labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],

       datasets: [

         {

           label: 'Revenue (₹ thousands)',

           data: [42, 58, 49, 72, 64, 86],

           borderColor: '#7567e8',

           backgroundColor: 'rgba(117, 103, 232, 0.12)',

           fill: true,

           tension: 0.4,

           pointRadius: 4,

           pointHoverRadius: 7,

         },

       ],

     }

     const options = {

       responsive: true,

       maintainAspectRatio: false,

       plugins: {

         legend: {

           display: false,

         },

         tooltip: {

           callbacks: {

             label: (context: { parsed: { y: number | null } }) =>

               `Revenue: ₹${context.parsed.y ?? 0}k`,

           },

         },

       },

       scales: {

         y: {

           beginAtZero: true,

           grid: {

             color: 'rgba(128, 128, 128, 0.12)',

           },

           ticks: {

             callback: (value: string | number) => `₹${value}k`,

           },

         },

         x: {

           grid: {

             display: false,

           },

         },

       },

     }

     return (

       <section className="panel">

         <div className="panel-head">

           <div>

             <h3>Revenue overview</h3>

             <p>Monthly billing volume · last 6 months</p>

           </div>

           <span className="legend">● Revenue</span>

         </div>

         <div style={{ height: '280px', width: '100%' }}>

           <Line data={data} options={options} />

         </div>

       </section>

     )

}


interface UsageMetric {
  metricType: 'api_requests' | 'compute_units' | 'storage'
  eventCount: number
  totalCostMinor: number
  currency: string
  unit: string
}

interface UsageSummary {
  organizationId: string
  totalEvents: number
  totalCostMinor: number
  byMetric: UsageMetric[]
}

function useUsageSummary() {
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    import('./services/api')
      .then(({ apiRequest }) =>
        apiRequest<UsageSummary>('/analytics/usage')
      )
      .then((result) => {
        if (active) setUsage(result)
      })
      .catch((err: Error) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { usage, loading, error }
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}

function metricLabel(metricType: string) {
  const labels: Record<string, string> = {
    api_requests: 'API requests',
    compute_units: 'Compute units',
    storage: 'Storage',
  }

  return labels[metricType] || metricType
}


function UsageAnalytics() {
  const { usage, loading, error } = useUsageSummary()

  const metrics = usage?.byMetric ?? []

  const data = {
    labels: metrics.map((item) => metricLabel(item.metricType)),
    datasets: [
      {
        label: 'Usage events',
        data: metrics.map((item) => item.eventCount),
        borderColor: '#7567e8',
        backgroundColor: '#7567e8',
        tension: 0.4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Usage events',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>Resource consumption</h3>
          <p>Actual usage records by metric</p>
        </div>
        <span className="legend">● Live data</span>
      </div>

      {loading ? (
        <p>Loading usage analytics...</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : metrics.length === 0 ? (
        <div className="info">
          <p>No usage records found for this organization yet.</p>
          <p>Total usage events: 0</p>
        </div>
      ) : (
        <>
          <div style={{ height: '300px', width: '100%' }}>
            <Line data={data} options={options} />
          </div>

          <p>
            Total usage events:{' '}
            {formatCount(usage?.totalEvents ?? 0)}
          </p>
        </>
      )}
    </section>
  )
}


function Usage() {
  const { usage, loading, error } = useUsageSummary()

  const metrics = usage?.byMetric ?? []

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>Usage this month</h3>
          <p>Recorded resource consumption</p>
        </div>
        <b className="usage-icon">⌁</b>
      </div>

      {loading ? (
        <p>Loading usage...</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <div className="usage-total">
            {formatCount(usage?.totalEvents ?? 0)}
            <small> usage events</small>
          </div>

          <div className="usage-labels">
            <span>Actual recorded events</span>
            <b>No estimated limit</b>
          </div>

          <div className="usage-list">
            {(['api_requests', 'compute_units', 'storage'] as const).map(
              (metricType) => {
                const metric = metrics.find(
                  (item) => item.metricType === metricType
                )

                return (
                  <p key={metricType}>
                    {metricLabel(metricType)}
                    <b>{formatCount(metric?.eventCount ?? 0)}</b>
                  </p>
                )
              }
            )}
          </div>
        </>
      )}
    </section>
  )
}


function UsageTotalStat() {
  const { usage, loading, error } = useUsageSummary()

  return (
    <Stat
      label="Total usage events"
      value={
        loading
          ? '...'
          : error
            ? 'Unavailable'
            : formatCount(usage?.totalEvents ?? 0)
      }
      change={loading ? 'Loading' : error ? 'Error' : 'Live data'}
      icon="⌁"
    />
  )
}



interface BillingTransaction {
  transactionId: string
  description?: string
  amountMinor: number
  currency: string
  status: 'pending' | 'success' | 'failed' | 'reversed'
  createdAt: string
}

function Transactions({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [page, setPage] = useState(1)
  const [transactions, setTransactions] = useState<BillingTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadTransactions() {
      try {
        setLoading(true)
        setError('')

        const { apiRequest } = await import('./services/api')
        const result = await apiRequest<BillingTransaction[]>('/billing/transactions?limit=100')

        if (!cancelled) {
          setTransactions(Array.isArray(result) ? result : [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load transactions.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadTransactions()

    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const text = `${t.transactionId} ${t.description || ''}`.toLowerCase()
      const matchesQuery = text.includes(query.toLowerCase())
      const matchesStatus =
        status === 'All statuses' ||
        t.status === status.toLowerCase()

      return matchesQuery && matchesStatus
    })
  }, [transactions, query, status])

  const size = compact ? 5 : 6
  const pages = Math.max(1, Math.ceil(filtered.length / size))
  const rows = compact
    ? filtered.slice(0, size)
    : filtered.slice((page - 1) * size, page * size)

  const formatAmount = (amountMinor: number, currency: string) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(amountMinor / 100)

  const formatDate = (value: string) =>
    value
      ? new Date(value).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—'

  const statusLabel = (value: string) => {
    if (value === 'success') return 'Successful'
    if (value === 'reversed') return 'Reversed'
    if (value === 'failed') return 'Failed'
    return 'Pending'
  }

  return (
    <section className="panel table-panel">
      <div className="panel-head">
        <div>
          <h3>{compact ? 'Recent transactions' : 'All transactions'}</h3>
          <p>
            {compact
              ? 'Your latest billing activity'
              : 'Review and manage your billing events'}
          </p>
        </div>
        {!compact && <small>{filtered.length} results</small>}
      </div>

      {!compact && (
        <div className="table-tools">
          <input
            placeholder="⌕ Search by ID or description..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <option>All statuses</option>
            <option value="success">Successful</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
          </select>
        </div>
      )}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>TRANSACTION</th>
              <th>CUSTOMER</th>
              <th>DESCRIPTION</th>
              <th>DATE</th>
              <th>AMOUNT</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="empty">Loading transactions...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="empty">{error}</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty">
                  No transactions found.
                </td>
              </tr>
            ) : (
              rows.map((t) => {
                const label = statusLabel(t.status)
                return (
                  <tr key={t.transactionId}>
                    <td className="id">{t.transactionId}</td>
                    <td>—</td>
                    <td>{t.description || 'Billing transaction'}</td>
                    <td>{formatDate(t.createdAt)}</td>
                    <td className="money">
                      {formatAmount(t.amountMinor, t.currency)}
                    </td>
                    <td>
                      <span className={`badge ${label.toLowerCase()}`}>
                        {label}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!compact && !loading && !error && (
        <div className="pagination">
          <span>Page {page} of {pages}</span>
          <div>
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              disabled={page === pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  )
}


type FinancialSummary = {
  accounts: {
    revenue: {
      balanceMinor: number
    }
  }
  transactions: {
    totalCount: number
    byStatus: Record<string, { count: number; totalAmountMinor: number }>
  }
}

function Dashboard() {
  const profile = getDemoProfile()

  const [financial, setFinancial] = useState<FinancialSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadFinancialData() {
      try {
        const { apiRequest } = await import('./services/api')
        const result = await apiRequest<FinancialSummary>(
          '/analytics/financial'
        )

        if (!cancelled) {
          setFinancial(result)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Unable to load financial data.'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadFinancialData()

    return () => {
      cancelled = true
    }
  }, [])

  const hour = new Date().getHours()

  const greeting =
    hour < 12
      ? 'Good morning'
      : hour < 17
        ? 'Good afternoon'
        : 'Good evening'

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const revenueMinor = financial?.accounts.revenue.balanceMinor ?? 0
  const totalTransactions = financial?.transactions.totalCount ?? 0
  const successfulTransactions =
    financial?.transactions.byStatus.success?.count ?? 0

  const successfulRate =
    totalTransactions > 0
      ? ((successfulTransactions / totalTransactions) * 100).toFixed(1)
      : '0.0'

  const formattedRevenue = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(revenueMinor / 100)

  return (
    <div className="stack">
      <Heading
        eyebrow={today.toUpperCase()}
        title={`${greeting}, ${profile.name} ✦`}
        subtitle={`Here's what's happening with ${profile.organization} today.`}
        action="Export report"
      />

      <div className="stats">
        <Stat
          label="Total revenue"
          value={loading ? 'Loading...' : formattedRevenue}
          change="Live from backend"
          comparison="current total"
          icon="₹"
        />

        <Stat
          label="Transactions"
          value={loading ? 'Loading...' : totalTransactions.toLocaleString('en-IN')}
          change="Live from backend"
          comparison="current total"
          icon="⇄"
        />

        <Stat
          label="Successful rate"
          value={loading ? 'Loading...' : `${successfulRate}%`}
          change="Live from backend"
          comparison="current rate"
          icon="✓"
        />

        <UsageTotalStat />
      </div>

      {error && (
        <div className="disclaimer">
          Unable to load live financial data: {error}
        </div>
      )}

      <div className="dash-grid">
        <Revenue />
        <Usage />
      </div>

      <Transactions compact />

      <div className="disclaimer">
        Revenue, transaction count and successful rate are connected to live
        backend data. Revenue chart and API usage are still illustrative.
      </div>
    </div>
  )
}

function Ledger() {

     return (

       <div className="stack">

         <Heading

eyebrow="FINANCIAL RECORDS"

title="Billing ledger"

subtitle="A complete, searchable record of billing events for your organization."

action="Export CSV"

         />

         <div className="stats mini-stats">

           <Stat label="Total volume" value="₹2,14,546" change="12.8%" icon="₹" />

           <Stat label="Successful" value="5" change="2.4%" icon="✓" />

           <Stat label="Pending" value="2" change="0%" icon="◷" />

           <Stat label="Failed" value="2" change="1.2%" icon="!" />

         </div>

         <Transactions />

       </div>

     )

}

function Activity() {

     return (

       <div className="stack">

         <Heading

eyebrow="PAYMENT ACTIVITY"

title="Transactions"

subtitle="Monitor payment events and their processing status."

         />

         <Transactions />

         <div className="info">

           Successful events have completed, pending events are awaiting processing,

           and failed events require investigation. These are demo records, not live payment results.

         </div>

       </div>

     )

}

function Analytics() {

     return (

       <div className="stack">

         <Heading

eyebrow="INSIGHTS & REPORTING"

title="Analytics"

subtitle="Understand billing performance and resource consumption."

         />

         <div className="stats">

           <Stat label="Gross revenue" value="₹8,42,590" change="12.8%" icon="₹" />

           <Stat label="Average transaction" value="₹6,564" change="4.1%" icon="↗" />

           <Stat label="Successful rate" value="98.6%" change="2.4%" icon="✓" />

           <UsageTotalStat />

         </div>
      <AnalyticsRevenue />
      <UsageAnalytics />
      <div className="info">
        These charts use illustrative demo values. Live revenue and tenant-specific
        usage metrics will be connected after the backend team shares its API contract.
      </div>

       </div>

     )

}

function Settings() {

     return (

       <div className="stack">

         <Heading

eyebrow="WORKSPACE PREFERENCES"

title="Settings"

subtitle="View your organization workspace details."

         />

         <section className="panel settings">

           <h3>Organization profile</h3>

           <p>Basic information associated with this demo workspace.</p>

           {[

             ['Organization name', demoTenant.name],

             ['Organization ID', demoTenant.id],

             ['Current plan', demoTenant.plan],

             ['Environment', 'Demo'],

           ].map(([label, value]) => (

             <div key={label}><span>{label}</span><b>{value}</b></div>

           ))}

         </section>

         <div className="info">

           Organization settings, team members, roles and security controls will be

           connected after the backend team provides the API contract.

         </div>

       </div>

     )

}

function Protected() {
  return sessionStorage.getItem('ledgerguard-auth-token')
    ? <Shell />
    : <Navigate to="/login" replace />
}

export default function App() {

     return (

       <Routes>

         <Route path="/login" element={<Login />} />

         <Route path="/signup" element={<Signup />} />

         <Route element={<Protected />}>

           <Route index element={<Dashboard />} />

           <Route path="ledger" element={<Ledger />} />

           <Route path="transactions" element={<Activity />} />

           <Route path="analytics" element={<Analytics />} />

           <Route path="settings" element={<Settings />} />

         </Route>

         <Route path="*" element={<Navigate to="/" replace />} />

       </Routes>

     )

}

