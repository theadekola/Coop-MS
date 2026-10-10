import {useEffect,useState} from 'react'
import toast from 'react-hot-toast'
import {useNavigate} from 'react-router-dom'
import api,{authApi} from '../../services/api'
import {useAuthStore} from '../../store/authStore'
export default function Security(){
  const {user,logout,updateUser}=useAuthStore(),navigate=useNavigate()
  const [sessions,setSessions]=useState<Awaited<ReturnType<typeof authApi.sessions>>>([])
  const [currentPassword,setPassword]=useState(''),[otp,setOtp]=useState(''),[secret,setSecret]=useState(''),[busy,setBusy]=useState(false)
  const [policy,setPolicy]=useState<Record<string,unknown>>({})
  const load=()=>authApi.sessions().then(setSessions).catch(()=>toast.error('Could not load sessions'))
  useEffect(()=>{load();authApi.me().then(updateUser);api.get('/security/policy').then(r=>setPolicy(r.data.data)).catch(()=>toast.error('Could not load security policy'))},[])
  const act=async(action:()=>Promise<unknown>)=>{setBusy(true);try{await action()}catch{toast.error('Security action failed. Check your password and code.')}finally{setBusy(false)}}
  return <main className="p-6 max-w-3xl space-y-6"><h1 className="text-xl font-bold">Account security</h1><section className="card p-4 space-y-3"><h2 className="font-bold">Authenticator app</h2><p>Two-factor authentication is {user?.twoFactorEnabled?'enabled':'disabled'}.</p>
    <label className="block">Current password<input className="input-field" type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setPassword(e.target.value)}/></label>
    {!user?.twoFactorEnabled && <button className="btn-secondary" disabled={busy} onClick={()=>act(async()=>{const setup=await authApi.setupTwoFactor(currentPassword);setSecret(setup.secret)})}>Set up authenticator</button>}
    {secret && <p>Add this key to your authenticator app, then enter its six-digit code: <code className="break-all">{secret}</code></p>}
    <label className="block">Authenticator code<input className="input-field" inputMode="numeric" autoComplete="one-time-code" value={otp} maxLength={6} onChange={e=>setOtp(e.target.value)}/></label>
    <button className="btn-primary" disabled={busy||(!secret&&!user?.twoFactorEnabled)} onClick={()=>act(async()=>{await authApi.setTwoFactor(!user?.twoFactorEnabled,currentPassword,otp);setSecret('');logout();navigate('/login');toast.success('Security updated. Sign in again.')})}>{user?.twoFactorEnabled?'Disable two-factor authentication':'Confirm and enable'}</button></section>
    <section className="card p-4"><h2 className="font-bold">Active sessions</h2><ul className="my-4 space-y-2">{sessions.map(s=><li key={s.SessionID}>{s.current?'This session':'Other session'} · Created {new Date(s.CreatedAt).toLocaleString()} · Expires {new Date(s.ExpiresAt).toLocaleString()}</li>)}</ul><button className="btn-secondary" disabled={busy} onClick={()=>act(async()=>{await authApi.revokeOtherSessions();await load();toast.success('Other sessions revoked')})}>Sign out other sessions</button></section>
    <section className="card p-4"><h2 className="font-bold">Enforced controls</h2><p>Access tokens: {String(policy.accessMinutes||15)} minutes. Password minimum: {String(policy.passwordMin||12)} characters.</p><p>{String(policy.expenseApproval||'')}</p><p>Audit records: {String(policy.audit||'')}</p></section></main>
}
