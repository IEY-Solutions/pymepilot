---
name: oauth-authentication
description: OAuth 2.0 completo con todos los flows y PKCE
---

\# Skill: OAuth Authentication

\#\# 🎯 Qué es  
Implementación completa de OAuth 1.0a y OAuth 2.0 para autenticación con APIs externas. Flows: Authorization Code, Client Credentials, Password Grant, PKCE, Device Flow, Refresh Tokens.

\*\*Analogía Simple:\*\*  
OAuth es como un sistema de pases de acceso a edificios:  
\- Authorization Code \= visitante que pide pase en recepción  
\- Client Credentials \= empleado con tarjeta permanente  
\- Refresh Token \= renovar pase sin volver a recepción  
\- PKCE \= verificación extra de identidad

En PymePilot:  
\- Kommo usa Authorization Code \+ PKCE  
\- WhatsApp usa Long-lived Access Token  
\- Internal services usan Client Credentials  
\- Refresh automático de tokens expirados

\*\*Por qué es CRÍTICO:\*\*  
\- Seguridad: nunca compartir passwords  
\- Scopes: permisos granulares  
\- Tokens expirados: auto-refresh  
\- Revocación: desconectar apps fácilmente

\#\# 📋 OAuth 2.0 Flows

\#\#\# Flow 1: Authorization Code (más común)

\*\*Cuándo usar:\*\*  
\- Apps web con backend  
\- Usuario debe dar consentimiento  
\- Acceso a datos del usuario

\*\*Diagrama:\*\*  
\`\`\`  
User → App → Authorization Server → User consiente →   
Authorization Server → App (code) → App exchange code →   
Authorization Server → App (access\_token \+ refresh\_token)  
\`\`\`

\*\*Implementación:\*\*  
\`\`\`typescript  
// Step 1: Redirect user to authorization URL  
function getAuthorizationURL(  
  clientId: string,  
  redirectUri: string,  
  scopes: string\[\],  
  state: string // Anti-CSRF token  
): string {  
  const params \= new URLSearchParams({  
    client\_id: clientId,  
    redirect\_uri: redirectUri,  
    response\_type: 'code',  
    scope: scopes.join(' '),  
    state: state  
  })  
    
  return \`https://oauth-provider.com/oauth/authorize?${params}\`  
}

// Step 2: Handle callback  
async function handleOAuthCallback(  
  code: string,  
  state: string,  
  expectedState: string,  
  clientId: string,  
  clientSecret: string,  
  redirectUri: string  
) {  
  // Validate state (prevent CSRF)  
  if (state \!== expectedState) {  
    throw new Error('Invalid state parameter')  
  }  
    
  // Exchange code for tokens  
  const response \= await fetch('https://oauth-provider.com/oauth/token', {  
    method: 'POST',  
    headers: {  
      'Content-Type': 'application/x-www-form-urlencoded',  
      'Accept': 'application/json'  
    },  
    body: new URLSearchParams({  
      grant\_type: 'authorization\_code',  
      code: code,  
      client\_id: clientId,  
      client\_secret: clientSecret,  
      redirect\_uri: redirectUri  
    })  
  })  
    
  if (\!response.ok) {  
    const error \= await response.json()  
    throw new Error(\`Token exchange failed: ${error.error\_description}\`)  
  }  
    
  const tokens \= await response.json()  
    
  return {  
    access\_token: tokens.access\_token,  
    refresh\_token: tokens.refresh\_token,  
    expires\_in: tokens.expires\_in,  
    token\_type: tokens.token\_type,  
    scope: tokens.scope  
  }  
}  
\`\`\`

\*\*Edge Function ejemplo:\*\*  
\`\`\`typescript  
// supabase/functions/oauth-callback/index.ts  
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'  
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) \=\> {  
  const url \= new URL(req.url)  
  const code \= url.searchParams.get('code')  
  const state \= url.searchParams.get('state')  
  const error \= url.searchParams.get('error')  
    
  if (error) {  
    return new Response(\`OAuth error: ${error}\`, { status: 400 })  
  }  
    
  if (\!code || \!state) {  
    return new Response('Missing code or state', { status: 400 })  
  }  
    
  try {  
    // Validate state (get from session/DB)  
    const { data: stateData } \= await supabase  
      .from('oauth\_states')  
      .select('\*')  
      .eq('state', state)  
      .single()  
      
    if (\!stateData) {  
      return new Response('Invalid state', { status: 400 })  
    }  
      
    // Exchange code for tokens  
    const tokens \= await exchangeCodeForTokens(  
      code,  
      Deno.env.get('OAUTH\_CLIENT\_ID')\!,  
      Deno.env.get('OAUTH\_CLIENT\_SECRET')\!,  
      'https://yourdomain.com/api/oauth/callback'  
    )  
      
    // Save tokens  
    const expiresAt \= new Date(Date.now() \+ tokens.expires\_in \* 1000\)  
      
    await supabase.from('oauth\_tokens').insert({  
      tenant\_id: stateData.tenant\_id,  
      provider: 'provider-name',  
      access\_token: tokens.access\_token,  
      refresh\_token: tokens.refresh\_token,  
      expires\_at: expiresAt.toISOString(),  
      scope: tokens.scope  
    })  
      
    // Delete state (one-time use)  
    await supabase.from('oauth\_states').delete().eq('state', state)  
      
    return new Response('Authorization successful\! You can close this window.', {  
      status: 200,  
      headers: { 'Content-Type': 'text/html' }  
    })  
      
  } catch (error) {  
    console.error('OAuth callback error:', error)  
    return new Response('Authorization failed', { status: 500 })  
  }  
})

async function exchangeCodeForTokens(  
  code: string,  
  clientId: string,  
  clientSecret: string,  
  redirectUri: string  
) {  
  const response \= await fetch('https://oauth-provider.com/oauth/token', {  
    method: 'POST',  
    headers: {  
      'Content-Type': 'application/x-www-form-urlencoded'  
    },  
    body: new URLSearchParams({  
      grant\_type: 'authorization\_code',  
      code,  
      client\_id: clientId,  
      client\_secret: clientSecret,  
      redirect\_uri: redirectUri  
    })  
  })  
    
  if (\!response.ok) {  
    throw new Error('Token exchange failed')  
  }  
    
  return await response.json()  
}  
\`\`\`

\#\#\# Flow 2: PKCE (Proof Key for Code Exchange)

\*\*Cuándo usar:\*\*  
\- Apps públicas (SPAs, mobile)  
\- No pueden guardar client\_secret de forma segura  
\- Previene authorization code interception

\*\*Implementación:\*\*  
\`\`\`typescript  
import { createHash } from 'https://deno.land/std@0.168.0/node/crypto.ts'

// Generate code verifier and challenge  
function generatePKCE() {  
  // Code verifier: random string 43-128 chars  
  const codeVerifier \= generateRandomString(128)  
    
  // Code challenge: SHA256(code\_verifier) → base64url  
  const hash \= createHash('sha256')  
    .update(codeVerifier)  
    .digest('base64')  
    
  const codeChallenge \= hash  
    .replace(/\\+/g, '-')  
    .replace(/\\//g, '\_')  
    .replace(/=/g, '')  
    
  return {  
    codeVerifier,  
    codeChallenge,  
    codeChallengeMethod: 'S256'  
  }  
}

function generateRandomString(length: number): string {  
  const chars \= 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.\_\~'  
  let result \= ''  
  const randomValues \= new Uint8Array(length)  
  crypto.getRandomValues(randomValues)  
    
  for (let i \= 0; i \< length; i++) {  
    result \+= chars\[randomValues\[i\] % chars.length\]  
  }  
    
  return result  
}

// Step 1: Authorization URL with PKCE  
function getAuthorizationURLWithPKCE(  
  clientId: string,  
  redirectUri: string,  
  codeChallenge: string  
): string {  
  const params \= new URLSearchParams({  
    client\_id: clientId,  
    redirect\_uri: redirectUri,  
    response\_type: 'code',  
    code\_challenge: codeChallenge,  
    code\_challenge\_method: 'S256'  
  })  
    
  return \`https://oauth-provider.com/oauth/authorize?${params}\`  
}

// Step 2: Token exchange with code\_verifier  
async function exchangeCodeWithPKCE(  
  code: string,  
  clientId: string,  
  codeVerifier: string,  
  redirectUri: string  
) {  
  const response \= await fetch('https://oauth-provider.com/oauth/token', {  
    method: 'POST',  
    headers: {  
      'Content-Type': 'application/x-www-form-urlencoded'  
    },  
    body: new URLSearchParams({  
      grant\_type: 'authorization\_code',  
      code,  
      client\_id: clientId,  
      code\_verifier: codeVerifier, // NO client\_secret  
      redirect\_uri: redirectUri  
    })  
  })  
    
  return await response.json()  
}  
\`\`\`

\#\#\# Flow 3: Client Credentials

\*\*Cuándo usar:\*\*  
\- Server-to-server  
\- Sin usuario involucrado  
\- App accede a sus propios recursos

\*\*Implementación:\*\*  
\`\`\`typescript  
async function getClientCredentialsToken(  
  clientId: string,  
  clientSecret: string,  
  scope?: string  
) {  
  const response \= await fetch('https://oauth-provider.com/oauth/token', {  
    method: 'POST',  
    headers: {  
      'Content-Type': 'application/x-www-form-urlencoded',  
      'Authorization': \`Basic ${btoa(\`${clientId}:${clientSecret}\`)}\`  
    },  
    body: new URLSearchParams({  
      grant\_type: 'client\_credentials',  
      ...(scope && { scope })  
    })  
  })  
    
  if (\!response.ok) {  
    throw new Error('Client credentials flow failed')  
  }  
    
  return await response.json()  
}  
\`\`\`

\#\#\# Flow 4: Refresh Token

\*\*Implementación:\*\*  
\`\`\`typescript  
async function refreshAccessToken(  
  refreshToken: string,  
  clientId: string,  
  clientSecret: string  
) {  
  const response \= await fetch('https://oauth-provider.com/oauth/token', {  
    method: 'POST',  
    headers: {  
      'Content-Type': 'application/x-www-form-urlencoded'  
    },  
    body: new URLSearchParams({  
      grant\_type: 'refresh\_token',  
      refresh\_token: refreshToken,  
      client\_id: clientId,  
      client\_secret: clientSecret  
    })  
  })  
    
  if (\!response.ok) {  
    const error \= await response.json()  
      
    // Refresh token inválido o expirado  
    if (error.error \=== 'invalid\_grant') {  
      throw new Error('REFRESH\_TOKEN\_EXPIRED')  
    }  
      
    throw new Error('Token refresh failed')  
  }  
    
  const tokens \= await response.json()  
    
  return {  
    access\_token: tokens.access\_token,  
    refresh\_token: tokens.refresh\_token || refreshToken, // Algunos providers no rotan  
    expires\_in: tokens.expires\_in  
  }  
}  
\`\`\`

\#\# 🔄 Auto-Refresh Logic  
\`\`\`typescript  
interface TokenData {  
  access\_token: string  
  refresh\_token: string  
  expires\_at: string  
}

async function getValidAccessToken(  
  tenantId: string,  
  provider: string  
): Promise\<string\> {  
  // Get tokens from DB  
  const { data: tokenData } \= await supabase  
    .from('oauth\_tokens')  
    .select('\*')  
    .eq('tenant\_id', tenantId)  
    .eq('provider', provider)  
    .single()  
    
  if (\!tokenData) {  
    throw new Error('No tokens found')  
  }  
    
  // Check if expired  
  const now \= new Date()  
  const expiresAt \= new Date(tokenData.expires\_at)  
    
  // Refresh si expira en menos de 5 minutos (buffer)  
  if (expiresAt.getTime() \- now.getTime() \< 5 \* 60 \* 1000\) {  
    console.log('Token expiring soon, refreshing...')  
      
    const newTokens \= await refreshAccessToken(  
      tokenData.refresh\_token,  
      Deno.env.get('OAUTH\_CLIENT\_ID')\!,  
      Deno.env.get('OAUTH\_CLIENT\_SECRET')\!  
    )  
      
    const newExpiresAt \= new Date(Date.now() \+ newTokens.expires\_in \* 1000\)  
      
    // Update in DB  
    await supabase.from('oauth\_tokens').update({  
      access\_token: newTokens.access\_token,  
      refresh\_token: newTokens.refresh\_token,  
      expires\_at: newExpiresAt.toISOString()  
    }).eq('tenant\_id', tenantId).eq('provider', provider)  
      
    return newTokens.access\_token  
  }  
    
  return tokenData.access\_token  
}  
\`\`\`

\#\# 🗄️ Database Schema  
\`\`\`sql  
\-- oauth\_tokens table  
CREATE TABLE oauth\_tokens (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
  provider TEXT NOT NULL, \-- 'kommo', 'salesforce', etc.  
  access\_token TEXT NOT NULL,  
  refresh\_token TEXT,  
  expires\_at TIMESTAMPTZ NOT NULL,  
  scope TEXT,  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  updated\_at TIMESTAMPTZ DEFAULT NOW(),  
    
  UNIQUE(tenant\_id, provider)  
);

\-- oauth\_states table (CSRF protection)  
CREATE TABLE oauth\_states (  
  id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
  state TEXT UNIQUE NOT NULL,  
  tenant\_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  
  code\_verifier TEXT, \-- For PKCE  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  expires\_at TIMESTAMPTZ NOT NULL \-- States expire after 10 mins  
);

\-- Index  
CREATE INDEX idx\_oauth\_states\_state ON oauth\_states(state);  
CREATE INDEX idx\_oauth\_states\_expires ON oauth\_states(expires\_at);

\-- Auto-delete expired states  
CREATE OR REPLACE FUNCTION delete\_expired\_oauth\_states()  
RETURNS void AS $$  
BEGIN  
  DELETE FROM oauth\_states WHERE expires\_at \< NOW();  
END;  
$$ LANGUAGE plpgsql;  
\`\`\`

\#\# 🚨 Errores Comunes

\#\#\# Error 1: No validar state (CSRF vulnerable)  
\`\`\`typescript  
// ❌ MAL \- No valida state  
const code \= url.searchParams.get('code')  
// Process code sin verificar state

// ✅ BIEN \- Valida state  
const state \= url.searchParams.get('state')  
const { data } \= await supabase  
  .from('oauth\_states')  
  .select('\*')  
  .eq('state', state)  
  .single()

if (\!data) throw new Error('Invalid state')  
\`\`\`

\#\#\# Error 2: No refreshar tokens automáticamente  
\`\`\`typescript  
// ❌ MAL \- Usar token expirado  
const token \= tokenData.access\_token  
// API call falla con 401

// ✅ BIEN \- Auto-refresh  
const token \= await getValidAccessToken(tenantId, provider)  
// Token siempre válido  
\`\`\`

\#\#\# Error 3: Exponer client\_secret en cliente  
\`\`\`typescript  
// ❌ MAL \- Client secret en frontend  
const clientSecret \= 'abc123...'  
// NUNCA en código cliente

// ✅ BIEN \- Solo en backend/Edge Function  
const clientSecret \= Deno.env.get('OAUTH\_CLIENT\_SECRET')  
\`\`\`

\#\# ✅ Checklist

\- \[ \] State parameter generado y validado (CSRF protection)  
\- \[ \] PKCE implementado (si app pública)  
\- \[ \] Tokens guardados en DB encriptada  
\- \[ \] Auto-refresh de access tokens  
\- \[ \] Client secret en variables de entorno  
\- \[ \] Error handling (invalid\_grant, etc.)  
\- \[ \] Scopes mínimos necesarios  
\- \[ \] Revocation endpoint implementado (opcional)

\---  
