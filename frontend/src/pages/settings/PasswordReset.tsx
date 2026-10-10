import {useState} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
import toast from 'react-hot-toast'
import {authApi} from '../../services/api'
import {useAuthStore} from '../../store/authStore'
export default function PasswordReset(){
 const location=useLocation(),navigate=useNavigate(),{logout}=useAuthStore()
 const [currentPassword,setCurrent]=useState(''),[newPassword,setNext]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false)
 if(location.pathname==='/forgot-password')return <main className="p-8 max-w-xl mx-auto space-y-4"><h1 className="text-xl font-bold">Account recovery</h1><p>Contact an authorised administrator to verify your identity and issue a new password. Reusable reset keys are no longer accepted.</p><button className="btn-primary" onClick={()=>navigate('/login')}>Return to sign in</button></main>
 return <main className="p-6 max-w-xl"><h1 className="text-xl font-bold">Change password</h1><form className="my-6 space-y-4" onSubmit={async e=>{e.preventDefault();if(newPassword!==confirm){toast.error('Passwords do not match');return}setBusy(true);try{await authApi.changePassword({currentPassword,newPassword});logout();navigate('/login');toast.success('Password changed. Sign in again.')}catch{toast.error('Could not change password')}finally{setBusy(false)}}}>
 <label className="block">Current password<input className="input-field" type="password" value={currentPassword} autoComplete="current-password" required onChange={e=>setCurrent(e.target.value)}/></label><label className="block">New password (12 characters minimum)<input className="input-field" type="password" value={newPassword} autoComplete="new-password" minLength={12} required onChange={e=>setNext(e.target.value)}/></label><label className="block">Confirm password<input className="input-field" type="password" value={confirm} autoComplete="new-password" required onChange={e=>setConfirm(e.target.value)}/></label><button className="btn-primary" disabled={busy}>Change password and sign out</button></form></main>
}
