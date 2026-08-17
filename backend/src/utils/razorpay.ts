import crypto from 'crypto';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_workonova_dummy';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'workonova_secret_dummy';

export interface CreateOrderParams {
  amount: number; // in INR (will be converted to paise)
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

/**
 * Creates a Razorpay Order using Razorpay REST API
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<{ success: boolean; order?: RazorpayOrderResponse; error?: string; keyId: string }> {
  try {
    const amountInPaise = Math.round(params.amount * 100);

    // If live/test credentials are not configured, generate a deterministic mock order for testing
    if (RAZORPAY_KEY_ID === 'rzp_test_workonova_dummy' || !process.env.RAZORPAY_KEY_ID) {
      console.log(`ℹ️ Razorpay using sandbox mock order for amount ₹${params.amount} (receipt: ${params.receipt})`);
      const mockOrder: RazorpayOrderResponse = {
        id: `order_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        entity: 'order',
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency: params.currency || 'INR',
        receipt: params.receipt,
        status: 'created',
        attempts: 0,
        notes: params.notes || {},
        created_at: Math.floor(Date.now() / 1000),
      };
      return { success: true, order: mockOrder, keyId: RAZORPAY_KEY_ID };
    }

    const authHeader = 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: params.currency || 'INR',
        receipt: params.receipt,
        notes: params.notes || {},
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('❌ Razorpay Order Creation Failed:', data);
      return { success: false, error: data.error?.description || 'Failed to create Razorpay order', keyId: RAZORPAY_KEY_ID };
    }

    return { success: true, order: data as RazorpayOrderResponse, keyId: RAZORPAY_KEY_ID };
  } catch (err: any) {
    console.error('❌ Razorpay API Error:', err);
    return { success: false, error: err.message || 'Razorpay connection error', keyId: RAZORPAY_KEY_ID };
  }
}

/**
 * Verifies the authenticity of Razorpay payment signature using HMAC SHA256
 */
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  try {
    // If mock test order, accept test signatures
    if (params.orderId.startsWith('order_mock_')) {
      return true;
    }

    if (!RAZORPAY_KEY_SECRET) {
      console.warn('⚠️ RAZORPAY_KEY_SECRET not set, signature verification bypassed in test mode');
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest('hex');

    const isValid = expectedSignature === params.signature;
    if (!isValid) {
      console.warn(`⚠️ Signature mismatch: expected ${expectedSignature}, received ${params.signature}`);
    }
    return isValid;
  } catch (err) {
    console.error('❌ Razorpay Signature Verification Error:', err);
    return false;
  }
}

export function getRazorpayKeyId(): string {
  return RAZORPAY_KEY_ID;
}
