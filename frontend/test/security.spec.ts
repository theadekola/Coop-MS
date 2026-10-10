import {test,expect} from '@playwright/test'
test('Built login renders under CSP and blocks an injected inline script',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/api/**',route=>route.fulfill({status:401,json:{success:false,message:'Sign in required'}}))
 const response=await page.goto('/login')
 expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
 await expect(page.getByRole('button',{name:'Sign In',exact:true})).toBeVisible()
 await page.evaluate(()=>{const script=document.createElement('script');script.textContent='window.inlineInjectionExecuted=true';document.body.appendChild(script)})
 expect(await page.evaluate(()=>Boolean((window as any).inlineInjectionExecuted))).toBe(false)
 expect(errors).toEqual([])
})
test('Password challenge is sent to OTP verification before a session is established',async({page})=>{
 let passwordStep=false,otpStep=false
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()).pathname
  if(url==='/api/auth/login'){
   const payload=route.request().postDataJSON();expect(payload.email).toBe('staff@example.test');expect(payload.password.length).toBeGreaterThanOrEqual(12)
   passwordStep=true;return route.fulfill({json:{success:true,requires2FA:true,challengeId:'test-password-challenge'}})
  }
  if(url==='/api/auth/verify-2fa'){
   expect(passwordStep).toBe(true);expect(route.request().postDataJSON()).toEqual({challengeId:'test-password-challenge',otp:'123456'})
   otpStep=true;return route.fulfill({json:{success:true,token:'test-session',user:{id:1,fullName:'Test staff',email:'staff@example.test',role:'staff'}}})
  }
  if(url==='/api/chat/rooms'||url==='/api/staff/directory')return route.fulfill({json:{success:true,data:[]}})
  return route.fulfill({status:401,json:{success:false,message:'Sign in required'}})
 })
 await page.goto('/login')
 await page.getByPlaceholder('Enter your email address').fill('staff@example.test')
 await page.getByPlaceholder('Enter your password').fill('test-password-only')
 await page.getByRole('button',{name:'Sign In',exact:true}).click()
 await expect(page.getByLabel('Authenticator code')).toBeVisible()
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('auth-storage')||'{}')?.state?.token||null)).toBe(null)
 await page.getByLabel('Authenticator code').fill('123456')
 await page.getByRole('button',{name:'Sign In',exact:true}).click()
 await expect(page).toHaveURL(/\/chat$/);expect(otpStep).toBe(true)
})
test('Retired private API cache is removed on application startup',async({page})=>{
 await page.goto('/login')
 await page.evaluate(async()=>{const cache=await caches.open('oshodi-coop-api');await cache.put('/api/private',new Response('private'))})
 await page.reload()
 await expect.poll(()=>page.evaluate(()=>caches.has('oshodi-coop-api'))).toBe(false)
})
