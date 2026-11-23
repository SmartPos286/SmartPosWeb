import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.NODE_ENV === 'production' ? Number(process.env.PORT || 3000) : 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'SmartPOS286', aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()) });
  });

  app.get('/api/bcv-rate', async (_req, res) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const response = await fetch('https://rates.dolarvzla.com/bcv/current.json', {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        res.status(502).json({
          ok: false,
          error: `Servicio BCV respondió HTTP ${response.status}`,
        });
        return;
      }

      const data = (await response.json()) as {
        current?: { usd?: number; eur?: number; date?: string };
      };
      const usdRate = Number(data?.current?.usd ?? 0);
      if (!Number.isFinite(usdRate) || usdRate <= 0) {
        res.status(502).json({
          ok: false,
          error: 'La respuesta del servicio BCV no incluyó una tasa USD válida.',
        });
        return;
      }

      res.json({
        ok: true,
        bcvRateUsd: usdRate,
        eurRate: Number(data?.current?.eur ?? 0),
        date: data?.current?.date ?? '',
        source: 'DolarVzla BCV',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al consultar tasa BCV';
      res.status(502).json({ ok: false, error: msg });
    }
  });

  function analyzeBusinessRequest(
    message: string,
    businessContext: string
  ): { reply: string; pendingAction?: any } {
    const lower = message.toLowerCase().trim();

    // 1. Detect customer creation request
    const clientMatch = message.match(
      /(?:crear|agregar|nuevo|registra|anota)\s+(?:al\s+)?cliente\s+([A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s.]+?)(?:,\s*|\s+)(?:con\s+)?(?:ci|cédula|cedula|rif|documento)?\s*([VJEGPvjegp]-?\d{5,9}(?:-\d)?)/i
    );
    if (clientMatch) {
      const name = clientMatch[1].trim();
      const documentId = clientMatch[2].toUpperCase().trim();
      const phoneMatch = message.match(/(?:telf?|teléfono|telefono|celular)?\s*(04\d{9}|\+?58\d{10})/i);
      const phone = phoneMatch ? phoneMatch[1] : '';
      return {
        reply: `He analizado tu solicitud. Preparé el registro para el cliente **${name}** con cédula/RIF **${documentId}**${phone ? ` y teléfono **${phone}**` : ''}. Pulsa el botón a continuación para confirmarlo y guardarlo en el sistema.`,
        pendingAction: {
          type: 'ADD_CUSTOMER',
          label: `Registrar Cliente: ${name}`,
          payload: {
            name,
            documentId,
            phone,
            address: '',
            clientType: documentId.startsWith('J') || documentId.startsWith('G') ? 'PERSONA_JURIDICA' : 'PERSONA_NATURAL',
          },
        },
      };
    }

    // 2. Detect product addition request
    const productMatch = message.match(
      /(?:crear|agregar|nuevo|registra)\s+producto\s+([A-Za-z0-9ÁÉÍÓÚáéíóúñÑ\s.]+?)(?:\s+(?:precio|\$|a)\s*(\d+(?:[.,]\d+)?))?(?:\s+(?:stock|cantidad)\s*(\d+))?$/i
    );
    if (productMatch && (lower.includes('producto') || lower.includes('artículo') || lower.includes('articulo'))) {
      const rawName = productMatch[1].trim();
      const priceUsd = Number((productMatch[2] || '1').replace(',', '.'));
      const stock = Number(productMatch[3] || '10');
      return {
        reply: `He analizado tu solicitud. Preparé el registro para el nuevo producto **${rawName}** con precio de **$${priceUsd.toFixed(2)} USD** y stock inicial de **${stock} unidades**. Pulsa para ingresarlo al inventario.`,
        pendingAction: {
          type: 'ADD_PRODUCT',
          label: `Agregar Producto: ${rawName}`,
          payload: {
            name: rawName,
            priceUsd,
            stock,
            category: 'General',
          },
        },
      };
    }

    // 3. Detect inventory update
    const updateMatch = message.match(
      /(?:actualiza|cambia|modifica|pon|ajusta)\s+(?:el\s+)?(?:stock|inventario|precio|existencia)\s+(?:de\s+)?([A-Za-z0-9ÁÉÍÓÚáéíóúñÑ\s.]+?)\s+(?:a|en)\s*(\d+(?:[.,]\d+)?)/i
    );
    if (updateMatch) {
      const query = updateMatch[1].trim();
      const val = Number(updateMatch[2].replace(',', '.'));
      const isPrice = lower.includes('precio') || lower.includes('costo') || lower.includes('$');
      return {
        reply: `He analizado tu instrucción para **${query}**. Preparé el ajuste de ${isPrice ? `precio a **$${val.toFixed(2)} USD**` : `stock a **${val} unidades**`}. Pulsa para aplicarlo.`,
        pendingAction: {
          type: 'UPDATE_INVENTORY',
          label: `Actualizar ${query}`,
          payload: {
            productQuery: query,
            newStock: isPrice ? undefined : val,
            newPriceUsd: isPrice ? val : undefined,
          },
        },
      };
    }

    // 4. Rate adjustment (Tasa BCV)
    const rateMatch = lower.match(/(?:tasa|bcv|dolar|dólar)\s*(?:a|=|en)?\s*(\d+(?:[.,]\d+)?)/i);
    if (rateMatch && (lower.includes('cambia') || lower.includes('pon') || lower.includes('actualiza') || lower.includes('fija') || lower.includes('sube') || lower.includes('baja'))) {
      const newRate = Number(rateMatch[1].replace(',', '.'));
      if (newRate > 0) {
        return {
          reply: `He analizado tu solicitud cambiaria. He preparado la actualización de la **Tasa Oficial BCV** a **Bs. ${newRate.toFixed(2)} por USD**. Confirma para aplicarla en todos los precios del sistema.`,
          pendingAction: {
            type: 'UPDATE_RATE',
            label: `Aplicar Tasa Bs. ${newRate.toFixed(2)}`,
            payload: { rate: newRate },
          },
        };
      }
    }

    // 5. Stock / Inventory inquiry
    if (lower.includes('stock') || lower.includes('agotad') || lower.includes('inventario') || lower.includes('faltan') || lower.includes('alerta')) {
      return {
        reply: `**Análisis de Inventario en Tiempo Real:**\n\n${businessContext}\n\nPuedes revisar los productos con existencias mínimas o modificar cantidades directamente en el catálogo.`,
        pendingAction: {
          type: 'NAVIGATE',
          label: 'Ir a Módulo de Inventario',
          payload: { route: 'inventory' },
        },
      };
    }

    // 6. Sales / revenue inquiry
    if (lower.includes('venta') || lower.includes('factura') || lower.includes('cuanto') || lower.includes('cuánto') || lower.includes('ingreso') || lower.includes('ganancia') || lower.includes('hoy')) {
      return {
        reply: `**Resumen de Ventas y Facturación de Hoy:**\n\n${businessContext}\n\nLos cobros reflejan la tasa oficial y métodos multimoneda (USD, Pago Móvil, Punto de Venta, Cashea y Crédito).`,
        pendingAction: {
          type: 'NAVIGATE',
          label: 'Ver Facturas Emitidas',
          payload: { route: 'invoices' },
        },
      };
    }

    // 7. Debts / receivables inquiry
    if (lower.includes('deuda') || lower.includes('cobrar') || lower.includes('credito') || lower.includes('crédito') || lower.includes('cashea')) {
      return {
        reply: `**Estado de Cuentas por Cobrar y Créditos:**\n\n${businessContext}\n\nPuedes registrar pagos parciales o totales de créditos directamente desde la lista de facturas.`,
        pendingAction: {
          type: 'NAVIGATE',
          label: 'Ver Cuentas por Cobrar',
          payload: { route: 'invoices' },
        },
      };
    }

    // 8. General executive commerce response
    return {
      reply: `He analizado tu solicitud **"${message}"** considerando el estado en vivo de tu comercio:\n\n${businessContext}\n\nPuedes pedirme registrar clientes, crear productos, ajustar inventario, cambiar la tasa BCV o resumir tus ventas.`,
    };
  }

  app.post('/api/gemini/chat', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    try {
      const { message, history = [], businessContext = '' } = req.body as {
        message: string;
        history?: Array<{ role: 'user' | 'assistant'; text: string }>;
        businessContext?: string;
      };

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Mensaje requerido.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        // Provide resilient intelligent analysis using commerce state
        const fallback = analyzeBusinessRequest(message, businessContext);
        res.json({
          reply: fallback.reply,
          pendingAction: fallback.pendingAction || null,
          webSources: [],
        });
        return;
      }

      const systemInstruction = `Eres "Oli", la asistente virtual inteligente y motor de pensamiento lógico integrada en SmartPOS286 (sistema POS multimoneda para comercios en Venezuela: $ USD y Bs. BCV, con IVA 16%, IGTF 3%, Cashea, Notas de Entrega, Presupuestos y Retenciones SENIAT).
Tienes la capacidad de:
1. Interpretar y analizar solicitudes complejas sobre el negocio y consultar información detallada de la app (ventas, inventario, clientes, deudas).
2. Proponer o ejecutar acciones de integración en el inventario (crear productos, actualizar stock o precios).
3. Registrar nuevos clientes en el sistema.
4. Realizar búsquedas en la web en tiempo real para tasas, normativas o información comercial.

Responde SIEMPRE en español claro, cordial, directo y orientado a resultados. Cuando sea apropiado, usa herramientas (function calling) o genera acciones pendientes (pendingAction) para que el usuario confirme o ejecute en la app.
Contexto actual del comercio:
${businessContext}`;

      const tools: any[] = [
        { googleSearch: {} },
        {
          functionDeclarations: [
            {
              name: 'addCustomer',
              description: 'Registra un nuevo cliente en el sistema POS con su nombre, cédula/RIF, teléfono y dirección.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Nombre o razón social del cliente' },
                  documentId: { type: Type.STRING, description: 'Cédula o RIF (ej. V-12345678 o J-30000000-0)' },
                  phone: { type: Type.STRING, description: 'Número de teléfono' },
                  address: { type: Type.STRING, description: 'Dirección física o fiscal' },
                  clientType: { type: Type.STRING, description: 'PERSONA_NATURAL, PERSONA_JURIDICA o GOBIERNO' },
                },
                required: ['name', 'documentId'],
              },
            },
            {
              name: 'addProduct',
              description: 'Agrega un nuevo producto al inventario del comercio.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING, description: 'Código o barra del producto' },
                  name: { type: Type.STRING, description: 'Nombre del producto' },
                  category: { type: Type.STRING, description: 'Categoría (ej. Alimentos, Bebidas, etc.)' },
                  priceUsd: { type: Type.NUMBER, description: 'Precio de venta en USD' },
                  stock: { type: Type.NUMBER, description: 'Cantidad inicial en inventario' },
                  costPriceUsd: { type: Type.NUMBER, description: 'Costo unitario en USD' },
                },
                required: ['name', 'priceUsd', 'stock'],
              },
            },
            {
              name: 'updateInventoryStock',
              description: 'Actualiza el stock o precio de un producto existente en el inventario.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  productQuery: { type: Type.STRING, description: 'Nombre o código del producto a buscar' },
                  newStock: { type: Type.NUMBER, description: 'Nueva cantidad total en stock (opcional)' },
                  newPriceUsd: { type: Type.NUMBER, description: 'Nuevo precio en USD (opcional)' },
                },
                required: ['productQuery'],
              },
            },
          ],
        },
      ];

      // Build clean alternating conversation turns starting with 'user'
      const cleanHistory: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];
      for (const item of history.slice(-8)) {
        const role: 'user' | 'model' = item.role === 'assistant' ? 'model' : 'user';
        const text = (item.text || '').trim();
        if (!text) continue;
        if (cleanHistory.length === 0) {
          if (role === 'user') {
            cleanHistory.push({ role, parts: [{ text }] });
          }
        } else {
          const prevRole = cleanHistory[cleanHistory.length - 1].role;
          if (prevRole !== role) {
            cleanHistory.push({ role, parts: [{ text }] });
          }
        }
      }

      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
        cleanHistory[cleanHistory.length - 1].parts[0].text += `\n${message}`;
      } else {
        cleanHistory.push({ role: 'user', parts: [{ text: message }] });
      }

      let reply = '';
      let action: any = null;
      const webSources: Array<{ title: string; url: string }> = [];

      try {
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: cleanHistory,
          config: {
            systemInstruction,
            tools,
            toolConfig: { includeServerSideToolInvocations: true },
          },
        });

        const functionCalls = response.functionCalls;
        try {
          reply = response.text ?? '';
        } catch {
          const textPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text);
          reply = textPart?.text ?? '';
        }

        if (functionCalls && functionCalls.length > 0) {
          const call = functionCalls[0];
          if (call.name === 'addCustomer') {
            const args = call.args as any;
            action = {
              type: 'ADD_CUSTOMER',
              label: `Registrar Cliente: ${args.name}`,
              payload: args,
            };
            reply = reply || `He preparado el registro para el cliente **${args.name}** (${args.documentId || 'Sin documento'}). Pulsa el botón para agregarlo al sistema.`;
          } else if (call.name === 'addProduct') {
            const args = call.args as any;
            action = {
              type: 'ADD_PRODUCT',
              label: `Agregar Producto: ${args.name}`,
              payload: args,
            };
            reply = reply || `He preparado la adición del producto **${args.name}** ($${args.priceUsd} USD, Stock: ${args.stock}). Pulsa el botón para agregarlo al inventario.`;
          } else if (call.name === 'updateInventoryStock') {
            const args = call.args as any;
            action = {
              type: 'UPDATE_INVENTORY',
              label: `Actualizar Inventario: ${args.productQuery}`,
              payload: args,
            };
            reply = reply || `He preparado la actualización para **${args.productQuery}**. Pulsa el botón para aplicarla.`;
          }
        }

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
          for (const chunk of groundingChunks) {
            if (chunk.web?.uri && chunk.web?.title) {
              webSources.push({ title: chunk.web.title, url: chunk.web.uri });
            }
          }
        }
      } catch (geminiError) {
        console.warn('Gemini generateContent error; using intelligent local analysis:', geminiError);
        const fallback = analyzeBusinessRequest(message, businessContext);
        reply = fallback.reply;
        action = fallback.pendingAction || null;
      }

      if (!reply) {
        const fallback = analyzeBusinessRequest(message, businessContext);
        reply = fallback.reply;
        action = action || fallback.pendingAction || null;
      }

      res.json({
        reply,
        pendingAction: action,
        webSources,
      });
    } catch (error) {
      console.error('Unhandled error in /api/gemini/chat:', error);
      const fallback = analyzeBusinessRequest(req.body?.message || '', req.body?.businessContext || '');
      res.json({
        reply: fallback.reply,
        pendingAction: fallback.pendingAction || null,
        webSources: [],
      });
    }
  });

  app.post('/api/gemini/invoice-ocr', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'La clave de Gemini no está configurada en el servidor (Settings > Secrets).',
      });
      return;
    }

    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body as {
        imageBase64: string;
        mimeType?: string;
      };

      if (!imageBase64) {
        res.status(400).json({ error: 'Imagen requerida en base64.' });
        return;
      }

      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: `Analiza esta factura de compra de proveedor (Venezuela/Latinoamérica) y extrae exactamente los datos solicitados en JSON.
Detecta si los montos están en dólares (USD) o en bolívares (VES / Bs.), el nombre del proveedor, RIF o documento, número de factura, porcentaje de IVA (ej. 16 o 0), y cada renglón de producto con su código si existe, descripción limpia, cantidad, costo unitario y costo total de línea.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              supplierName: { type: Type.STRING },
              supplierDocumentId: { type: Type.STRING },
              invoiceNumber: { type: Type.STRING },
              currency: { type: Type.STRING, description: 'USD or VES' },
              ivaPercentage: { type: Type.NUMBER },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    code: { type: Type.STRING },
                    name: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    unitCost: { type: Type.NUMBER },
                    totalCost: { type: Type.NUMBER },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error procesando factura con Gemini OCR';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/gemini/pos-ticket-ocr', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'La clave de Gemini no está configurada en el servidor (Settings > Secrets).',
      });
      return;
    }

    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body as {
        imageBase64: string;
        mimeType?: string;
      };

      if (!imageBase64) {
        res.status(400).json({ error: 'Imagen requerida en base64.' });
        return;
      }

      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: `Lee este comprobante / ticket de punto de venta bancario (datáfono en Venezuela o tarjeta).
Extrae: fecha y hora (dd/MM/yyyy HH:mm), N° de recibo/lote, N° de referencia, código de aprobación, últimos 4 dígitos o tarjeta enmascarada (ej: ****1234), tipo de operación (COMPRA, ANULACION, DEBITO, CREDITO), monto total numérico, moneda (VES o USD), estado (APROBADA, RECHAZADA, ANULADA, PENDIENTE), banco o terminal (ej: Banesco, Mercantil, Credicard, Provincial, Bancamiga), y el texto crudo leído.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transactionDateTime: { type: Type.STRING },
              receiptNumber: { type: Type.STRING },
              referenceNumber: { type: Type.STRING },
              approvalNumber: { type: Type.STRING },
              maskedCardNumber: { type: Type.STRING },
              operationType: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER },
              currency: { type: Type.STRING },
              transactionStatus: { type: Type.STRING },
              bankOrTerminal: { type: Type.STRING },
              rawOcrText: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error leyendo ticket de punto de venta';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/gemini/organize-inventory', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'La clave de Gemini no está configurada en el servidor (Settings > Secrets).',
      });
      return;
    }

    try {
      const { products = [] } = req.body as {
        products: Array<{ id: number; name: string; category: string }>;
      };

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Normaliza y organiza las categorías de estos productos de un comercio en español (por ejemplo: Alimentos, Bebidas, Limpieza, Charcutería, Farmacia, Electrónica, Ferretería, Papelería, Combos, General). Devuelve solo un JSON con "updates": lista de {id, category, suggestedName}.
Productos: ${JSON.stringify(products.slice(0, 80))}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              updates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    category: { type: Type.STRING },
                    suggestedName: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error organizando inventario con IA';
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartPOS286 server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start SmartPOS286 server:', err);
  process.exit(1);
});
