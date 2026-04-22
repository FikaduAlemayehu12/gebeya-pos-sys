import { supabase } from '@/integrations/supabase/client';

export type ActivityAction =
  | 'sale_created' | 'sale_voided' | 'refund_issued'
  | 'cart_item_added' | 'cart_item_removed' | 'cart_modified'
  | 'price_override' | 'discount_applied'
  | 'payment_received' | 'credit_sale_created' | 'credit_payment_collected'
  | 'stock_adjusted' | 'product_created' | 'product_updated' | 'product_deleted'
  | 'cash_drawer_open' | 'cash_in' | 'cash_out'
  | 'user_login' | 'user_logout' | 'manager_override'
  | 'z_report_opened' | 'z_report_closed';

export async function logActivity(
  actionType: ActivityAction,
  description: string,
  details?: Record<string, any>,
  refs?: { saleId?: string; productId?: string; customerId?: string; amount?: number }
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('pos_activity_logs').insert({
    user_id: user.id,
    action_type: actionType,
    description,
    details: details || null,
    sale_id: refs?.saleId || null,
    product_id: refs?.productId || null,
    customer_id: refs?.customerId || null,
    amount: refs?.amount || null,
  } as any);
}
