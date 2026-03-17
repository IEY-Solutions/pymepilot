\# Skill: Data Transformation

\#\# 🎯 Qué es  
Transformación de datos entre APIs externas y sistema interno. Schema mapping, type conversion, normalization, denormalization, field aliasing, default values, y validación.

\*\*Analogía Simple:\*\*  
Data transformation es como traducir entre idiomas:  
\- Schema mapping \= diccionario (campo X en API \= campo Y en DB)  
\- Type conversion \= convertir medidas (millas a km)  
\- Normalization \= formato estándar (fechas, teléfonos)  
\- Validation \= corrector ortográfico  
\- Default values \= rellenar espacios en blanco

En PymePilot:  
\- Lead de Kommo → Customer en PymePilot  
\- WhatsApp status → Estado de prediction  
\- Formatos de fecha diferentes entre APIs  
\- Teléfonos en formatos variados  
\- Custom fields mapeados

\*\*Por qué es CRÍTICO:\*\*  
\- Consistency: mismos datos, mismo formato  
\- Validation: data limpia, sin errores  
\- Flexibility: adaptar a cualquier API  
\- Debugging: trazabilidad de transformaciones

\#\# 📋 Patterns Core

\#\#\# Pattern 1: Schema Mapping

\*\*Definir mapeos declarativos:\*\*  
\`\`\`typescript  
interface FieldMapping {  
  source: string              // Campo en API externa  
  target: string              // Campo en sistema interno  
  transform?: (value: any) \=\> any  
  required?: boolean  
  defaultValue?: any  
}

interface SchemaMapping {  
  fields: FieldMapping\[\]  
  validate?: (data: any) \=\> boolean  
}

// Ejemplo: Kommo Lead → PymePilot Customer  
const kommoToCustomerMapping: SchemaMapping \= {  
  fields: \[  
    {  
      source: 'name',  
      target: 'name',  
      required: true  
    },  
    {  
      source: 'custom\_fields.EMAIL',  
      target: 'email',  
      transform: (value) \=\> value?.toLowerCase().trim(),  
      required: true  
    },  
    {  
      source: 'custom\_fields.PHONE',  
      target: 'phone',  
      transform: normalizePhone,  
      required: false  
    },  
    {  
      source: 'created\_at',  
      target: 'created\_at',  
      transform: (timestamp) \=\> new Date(timestamp \* 1000).toISOString()  
    },  
    {  
      source: 'status\_id',  
      target: 'status',  
      transform: (statusId) \=\> mapKommoStatus(statusId),  
      defaultValue: 'active'  
    },  
    {  
      source: 'id',  
      target: 'external\_id',  
      required: true  
    }  
  \],  
  validate: (data) \=\> {  
    // Validaciones custom  
    return data.email?.includes('@') && data.name?.length \> 0  
  }  
}

// Mapper genérico  
function transformData(  
  sourceData: any,  
  mapping: SchemaMapping  
): any {  
  const result: any \= {}  
    
  for (const field of mapping.fields) {  
    // Obtener valor (soporta nested paths)  
    let value \= getNestedValue(sourceData, field.source)  
      
    // Aplicar transformación  
    if (field.transform) {  
      value \= field.transform(value)  
    }  
      
    // Default value si no existe  
    if (value \=== undefined || value \=== null) {  
      if (field.required) {  
        throw new Error(\`Missing required field: ${field.source}\`)  
      }  
      value \= field.defaultValue  
    }  
      
    // Setear en target (soporta nested paths)  
    setNestedValue(result, field.target, value)  
  }  
    
  // Validación final  
  if (mapping.validate && \!mapping.validate(result)) {  
    throw new Error('Data validation failed')  
  }  
    
  return result  
}

// Helper: obtener valor nested  
function getNestedValue(obj: any, path: string): any {  
  return path.split('.').reduce((current, key) \=\> {  
    if (current \=== undefined || current \=== null) return undefined  
      
    // Soportar arrays en custom\_fields  
    if (Array.isArray(current)) {  
      const item \= current.find((i: any) \=\> i.code \=== key || i.id \=== key)  
      return item?.values?.\[0\]?.value || item  
    }  
      
    return current\[key\]  
  }, obj)  
}

// Helper: setear valor nested  
function setNestedValue(obj: any, path: string, value: any): void {  
  const keys \= path.split('.')  
  const lastKey \= keys.pop()\!  
    
  const target \= keys.reduce((current, key) \=\> {  
    if (\!current\[key\]) current\[key\] \= {}  
    return current\[key\]  
  }, obj)  
    
  target\[lastKey\] \= value  
}

// Uso  
const kommoLead \= {  
  id: 12345,  
  name: 'Acme Corp',  
  created\_at: 1704067200,  
  status\_id: 142,  
  custom\_fields: \[  
    { code: 'EMAIL', values: \[{ value: 'CONTACT@ACME.COM' }\] },  
    { code: 'PHONE', values: \[{ value: '+54 9 11 1234-5678' }\] }  
  \]  
}

const customer \= transformData(kommoLead, kommoToCustomerMapping)

// Resultado:  
// {  
//   name: 'Acme Corp',  
//   email: 'contact@acme.com',  
//   phone: '5491112345678',  
//   created\_at: '2024-01-01T00:00:00.000Z',  
//   status: 'active',  
//   external\_id: 12345  
// }  
\`\`\`

\#\#\# Pattern 2: Type Conversion

\*\*Conversiones comunes:\*\*  
\`\`\`typescript  
// String → Number  
function toNumber(value: any, defaultValue: number \= 0): number {  
  if (typeof value \=== 'number') return value  
  const parsed \= parseFloat(value)  
  return isNaN(parsed) ? defaultValue : parsed  
}

// String → Boolean  
function toBoolean(value: any): boolean {  
  if (typeof value \=== 'boolean') return value  
  if (typeof value \=== 'string') {  
    return \['true', '1', 'yes', 'on'\].includes(value.toLowerCase())  
  }  
  return Boolean(value)  
}

// Any → Date  
function toDate(value: any): Date | null {  
  if (\!value) return null  
  if (value instanceof Date) return value  
    
  // Unix timestamp (seconds)  
  if (typeof value \=== 'number' && value \< 10000000000\) {  
    return new Date(value \* 1000\)  
  }  
    
  // Unix timestamp (milliseconds)  
  if (typeof value \=== 'number') {  
    return new Date(value)  
  }  
    
  // ISO string  
  if (typeof value \=== 'string') {  
    const date \= new Date(value)  
    return isNaN(date.getTime()) ? null : date  
  }  
    
  return null  
}

// Date → ISO string  
function toISOString(value: any): string | null {  
  const date \= toDate(value)  
  return date ? date.toISOString() : null  
}

// Array → String (comma-separated)  
function arrayToString(value: any, separator: string \= ', '): string {  
  if (\!Array.isArray(value)) return String(value || '')  
  return value.filter(Boolean).join(separator)  
}

// String → Array  
function stringToArray(value: any, separator: string \= ','): string\[\] {  
  if (Array.isArray(value)) return value  
  if (\!value) return \[\]  
  return String(value).split(separator).map(s \=\> s.trim()).filter(Boolean)  
}

// Uso en mapping  
const mapping: SchemaMapping \= {  
  fields: \[  
    {  
      source: 'price',  
      target: 'price',  
      transform: (v) \=\> toNumber(v, 0\)  
    },  
    {  
      source: 'is\_active',  
      target: 'active',  
      transform: toBoolean  
    },  
    {  
      source: 'created\_at',  
      target: 'created\_at',  
      transform: toISOString  
    },  
    {  
      source: 'tags',  
      target: 'tags',  
      transform: stringToArray  
    }  
  \]  
}  
\`\`\`

\#\#\# Pattern 3: Normalization

\*\*Normalizar formatos comunes:\*\*  
\`\`\`typescript  
// Teléfonos: convertir a formato E.164 internacional  
function normalizePhone(phone: string, defaultCountryCode: string \= '54'): string | null {  
  if (\!phone) return null  
    
  // Remover todo excepto dígitos y \+  
  let cleaned \= phone.replace(/\[^\\d+\]/g, '')  
    
  // Si empieza con \+, validar  
  if (cleaned.startsWith('+')) {  
    return cleaned.length \>= 10 ? cleaned : null  
  }  
    
  // Si empieza con 00 (formato internacional alternativo)  
  if (cleaned.startsWith('00')) {  
    return '+' \+ cleaned.substring(2)  
  }  
    
  // Si empieza con 0 (código de área local en Argentina)  
  if (cleaned.startsWith('0')) {  
    cleaned \= cleaned.substring(1)  
  }  
    
  // Si empieza con 15 (móvil en Argentina sin código de área)  
  if (cleaned.startsWith('15')) {  
    cleaned \= cleaned.substring(2)  
  }  
    
  // Si empieza con 9 (WhatsApp Argentina)  
  if (cleaned.startsWith('9')) {  
    cleaned \= cleaned.substring(1)  
  }  
    
  // Agregar código de país  
  return \`+${defaultCountryCode}${cleaned}\`  
}

// Ejemplos:  
// '+54 9 11 1234-5678' → '+5491112345678'  
// '011 1234-5678'      → '+5491112345678'  
// '15 1234-5678'       → '+5491112345678'  
// '1234-5678'          → '+5491112345678' (asume 11\)

// Emails: lowercase \+ trim  
function normalizeEmail(email: string): string | null {  
  if (\!email) return null  
    
  const normalized \= email.toLowerCase().trim()  
    
  // Validar formato básico  
  if (\!/^\[^\\s@\]+@\[^\\s@\]+\\.\[^\\s@\]+$/.test(normalized)) {  
    return null  
  }  
    
  return normalized  
}

// URLs: agregar protocolo si falta  
function normalizeURL(url: string): string | null {  
  if (\!url) return null  
    
  let normalized \= url.trim()  
    
  if (\!normalized.startsWith('http://') && \!normalized.startsWith('https://')) {  
    normalized \= 'https://' \+ normalized  
  }  
    
  try {  
    new URL(normalized) // Validar  
    return normalized  
  } catch {  
    return null  
  }  
}

// Nombres: Title Case  
function normalizeName(name: string): string {  
  if (\!name) return ''  
    
  return name  
    .trim()  
    .split(/\\s+/)  
    .map(word \=\>   
      word.charAt(0).toUpperCase() \+ word.slice(1).toLowerCase()  
    )  
    .join(' ')  
}

// IDs: remover espacios, lowercase  
function normalizeId(id: string): string {  
  return id.trim().toLowerCase().replace(/\\s+/g, '-')  
}  
\`\`\`

\#\#\# Pattern 4: Validation con Zod  
\`\`\`typescript  
import { z } from 'https://deno.land/x/zod/mod.ts'

// Schema de validación  
const CustomerSchema \= z.object({  
  name: z.string().min(1, 'Name required').max(200),  
  email: z.string().email('Invalid email'),  
  phone: z.string().regex(/^\\+\\d{10,15}$/, 'Invalid phone format').optional(),  
  status: z.enum(\['active', 'inactive', 'pending'\]),  
  created\_at: z.string().datetime(),  
  external\_id: z.union(\[z.string(), z.number()\]),  
  metadata: z.record(z.any()).optional()  
})

type Customer \= z.infer\<typeof CustomerSchema\>

// Validar \+ transformar  
function validateAndTransform(  
  sourceData: any,  
  mapping: SchemaMapping,  
  schema: z.ZodSchema  
): Customer {  
  // 1\. Transformar  
  const transformed \= transformData(sourceData, mapping)  
    
  // 2\. Validar con Zod  
  const result \= schema.safeParse(transformed)  
    
  if (\!result.success) {  
    const errors \= result.error.errors.map(e \=\>   
      \`${e.path.join('.')}: ${e.message}\`  
    ).join(', ')  
      
    throw new Error(\`Validation failed: ${errors}\`)  
  }  
    
  return result.data  
}

// Uso  
try {  
  const customer \= validateAndTransform(  
    kommoLead,  
    kommoToCustomerMapping,  
    CustomerSchema  
  )  
    
  // customer es tipo-safe Customer  
  await saveCustomer(customer)  
    
} catch (error) {  
  console.error('Transformation failed:', error)  
  // Enviar a DLQ para review manual  
}  
\`\`\`

\#\#\# Pattern 5: Bidirectional Mapping

\*\*Transformar en ambas direcciones:\*\*  
\`\`\`typescript  
interface BidirectionalMapping {  
  toInternal: SchemaMapping  
  toExternal: SchemaMapping  
}

const customerMapping: BidirectionalMapping \= {  
  // External API → Internal DB  
  toInternal: {  
    fields: \[  
      { source: 'id', target: 'external\_id' },  
      { source: 'name', target: 'name', transform: normalizeName },  
      { source: 'email', target: 'email', transform: normalizeEmail },  
      { source: 'phone', target: 'phone', transform: normalizePhone }  
    \]  
  },  
    
  // Internal DB → External API  
  toExternal: {  
    fields: \[  
      { source: 'external\_id', target: 'id' },  
      { source: 'name', target: 'name' },  
      { source: 'email', target: 'email' },  
      { source: 'phone', target: 'phone', transform: formatPhoneForAPI }  
    \]  
  }  
}

function formatPhoneForAPI(phone: string): string {  
  // \+5491112345678 → \+54 9 11 1234-5678  
  if (\!phone || \!phone.startsWith('+54')) return phone  
    
  const digits \= phone.substring(3) // Remove \+54  
    
  if (digits.length \=== 10\) {  
    // 9 11 1234 5678  
    return \`+54 ${digits\[0\]} ${digits.substring(1, 3)} ${digits.substring(3, 7)}-${digits.substring(7)}\`  
  }  
    
  return phone  
}

// Sync bidireccional  
async function syncCustomerBidirectional(externalData: any, internalId?: string) {  
  // External → Internal  
  const internalData \= transformData(externalData, customerMapping.toInternal)  
    
  let customer  
  if (internalId) {  
    // Update existente  
    customer \= await updateCustomer(internalId, internalData)  
  } else {  
    // Create nuevo  
    customer \= await createCustomer(internalData)  
  }  
    
  // Internal → External (sync back)  
  const externalUpdate \= transformData(customer, customerMapping.toExternal)  
  await updateExternalAPI(externalUpdate)  
    
  return customer  
}  
\`\`\`

\#\#\# Pattern 6: Batch Transformation  
\`\`\`typescript  
async function transformBatch\<T\>(  
  items: any\[\],  
  mapping: SchemaMapping,  
  schema: z.ZodSchema,  
  options: {  
    batchSize?: number  
    onError?: 'skip' | 'stop' | 'collect'  
  } \= {}  
): Promise\<{  
  success: T\[\]  
  errors: Array\<{ item: any; error: Error }\>  
}\> {  
  const { batchSize \= 100, onError \= 'collect' } \= options  
    
  const results: T\[\] \= \[\]  
  const errors: Array\<{ item: any; error: Error }\> \= \[\]  
    
  // Procesar en batches  
  for (let i \= 0; i \< items.length; i \+= batchSize) {  
    const batch \= items.slice(i, i \+ batchSize)  
      
    for (const item of batch) {  
      try {  
        const transformed \= validateAndTransform(item, mapping, schema)  
        results.push(transformed)  
          
      } catch (error: any) {  
        if (onError \=== 'stop') {  
          throw error  
        } else if (onError \=== 'collect') {  
          errors.push({ item, error })  
        }  
        // Si 'skip', continuar sin hacer nada  
      }  
    }  
      
    // Log progreso  
    console.log(\`Processed ${Math.min(i \+ batchSize, items.length)}/${items.length}\`)  
  }  
    
  return { success: results, errors }  
}

// Uso  
const { success, errors } \= await transformBatch(  
  kommoLeads,  
  kommoToCustomerMapping,  
  CustomerSchema,  
  { batchSize: 50, onError: 'collect' }  
)

console.log(\`Transformed: ${success.length}, Failed: ${errors.length}\`)

if (errors.length \> 0\) {  
  // Guardar errores para review manual  
  await saveTransformationErrors(errors)  
}

// Insertar exitosos  
await batchInsertCustomers(success)  
\`\`\`

\#\#\# Pattern 7: Custom Field Handling  
\`\`\`typescript  
// Kommo custom fields → flat object  
function extractCustomFields(  
  customFields: Array\<{ code: string; values: Array\<{ value: any }\> }\>,  
  fieldMapping: Record\<string, string\>  
): Record\<string, any\> {  
  const result: Record\<string, any\> \= {}  
    
  for (const field of customFields) {  
    const targetField \= fieldMapping\[field.code\]  
      
    if (targetField) {  
      const value \= field.values?.\[0\]?.value  
        
      if (value \!== undefined && value \!== null) {  
        result\[targetField\] \= value  
      }  
    }  
  }  
    
  return result  
}

// Uso  
const KOMMO\_FIELD\_MAPPING \= {  
  'EMAIL': 'email',  
  'PHONE': 'phone',  
  'COMPANY': 'company\_name',  
  'TENANT\_ID': 'tenant\_id',  
  'CUIT': 'tax\_id'  
}

const customFieldsData \= extractCustomFields(  
  kommoLead.custom\_fields,  
  KOMMO\_FIELD\_MAPPING  
)

// Flat object → Kommo custom fields  
function buildCustomFields(  
  data: Record\<string, any\>,  
  fieldMapping: Record\<string, string\>  
): Array\<{ id: number; values: Array\<{ value: any }\> }\> {  
  const customFields \= \[\]  
    
  for (const \[sourceField, targetCode\] of Object.entries(fieldMapping)) {  
    const value \= data\[sourceField\]  
      
    if (value \!== undefined && value \!== null) {  
      customFields.push({  
        id: KOMMO\_FIELD\_IDS\[targetCode\], // IDs numéricos de Kommo  
        values: \[{ value }\]  
      })  
    }  
  }  
    
  return customFields  
}  
\`\`\`

\#\# 💻 Complete Transformation Pipeline  
\`\`\`typescript  
class DataTransformer\<TSource, TTarget\> {  
  constructor(  
    private mapping: SchemaMapping,  
    private schema: z.ZodSchema\<TTarget\>  
  ) {}  
    
  transform(source: TSource): TTarget {  
    // 1\. Map fields  
    const mapped \= transformData(source, this.mapping)  
      
    // 2\. Validate  
    const result \= this.schema.safeParse(mapped)  
      
    if (\!result.success) {  
      throw new TransformationError(  
        'Validation failed',  
        result.error.errors  
      )  
    }  
      
    return result.data  
  }  
    
  transformBatch(  
    sources: TSource\[\],  
    options?: { onError?: 'skip' | 'stop' | 'collect' }  
  ) {  
    return transformBatch(sources, this.mapping, this.schema, options)  
  }  
}

class TransformationError extends Error {  
  constructor(  
    message: string,  
    public validationErrors: z.ZodError\['errors'\]  
  ) {  
    super(message)  
    this.name \= 'TransformationError'  
  }  
}

// Uso  
const kommoTransformer \= new DataTransformer(  
  kommoToCustomerMapping,  
  CustomerSchema  
)

try {  
  const customer \= kommoTransformer.transform(kommoLead)  
  await saveCustomer(customer)  
} catch (error) {  
  if (error instanceof TransformationError) {  
    console.error('Validation errors:', error.validationErrors)  
  }  
  throw error  
}  
\`\`\`

\#\# 🚨 Errores Comunes

\#\#\# Error 1: No validar después de transformar  
\`\`\`typescript  
// ❌ MAL \- Transformar sin validar  
const customer \= transformData(kommoLead, mapping)  
await saveCustomer(customer) // Puede tener data inválida

// ✅ BIEN \- Validar con schema  
const customer \= validateAndTransform(kommoLead, mapping, CustomerSchema)  
await saveCustomer(customer) // Data válida garantizada  
\`\`\`

\#\#\# Error 2: Asumir tipos  
\`\`\`typescript  
// ❌ MAL \- Asumir que es number  
const price \= data.price \* 1.1

// ✅ BIEN \- Convertir explícitamente  
const price \= toNumber(data.price, 0\) \* 1.1  
\`\`\`

\#\#\# Error 3: No normalizar antes de guardar  
\`\`\`typescript  
// ❌ MAL \- Guardar como viene  
await saveCustomer({ phone: '+54 9 11 1234-5678' })

// ✅ BIEN \- Normalizar primero  
await saveCustomer({ phone: normalizePhone('+54 9 11 1234-5678') })  
// '+5491112345678'  
\`\`\`

\#\# ✅ Checklist

\- \[ \] Schema mappings definidos declarativamente  
\- \[ \] Type conversions para todos los campos  
\- \[ \] Normalization de formatos (phone, email, URL)  
\- \[ \] Validación con Zod después de transformar  
\- \[ \] Default values para campos opcionales  
\- \[ \] Error handling con tipos específicos  
\- \[ \] Bidirectional mapping (si sync bidireccional)  
\- \[ \] Batch transformation optimizado  
\- \[ \] Logging de transformaciones fallidas

\---  
