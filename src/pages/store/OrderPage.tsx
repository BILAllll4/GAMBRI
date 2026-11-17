import { useParams } from 'react-router-dom'
import { api, formatMAD } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { useTransitionNavigate } from '../../components/Curtain'
import { Khatam } from '../../components/Ornaments'
import { StoreState } from './StoreShared'
import { useT } from '../../lib/i18n'

export default function OrderPage() {
  const t = useT()
  const { reference = '' } = useParams()
  const go = useTransitionNavigate()
  const { data, loading, error, retry } = useAsync(() => api.order(reference), [reference])

  return (
    <div className="min-h-screen bg-olive px-4 pb-24 pt-28 sm:px-8 sm:pt-32">
      <StoreState loading={loading} error={error} retry={retry}>
        {data && (
          <div className="mx-auto max-w-3xl">
            <Khatam className="h-14 w-14 text-gold" />
            <p className="label mt-8 text-gold">{t({ en: 'Order', fr: 'Commande', ar: 'الطلب' })} {data.reference} · {data.status}</p>
            <h1 className="display mt-4 text-5xl leading-[0.95] text-ivory sm:text-7xl">
              {t({ en: 'Shukran', fr: 'Choukran', ar: 'شكرًا' })}, {data.firstName}.
              <br />
              <span className="italic text-beige">{t({ en: 'Your order is in.', fr: 'Votre commande est enregistrée.', ar: 'تم تسجيل طلبك.' })}</span>
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ivory/70">
              {t({
                en: `We will call you to confirm delivery to ${data.city}. You pay ${formatMAD(data.total)} in cash when it arrives. Keep your reference:`,
                fr: `Nous vous appellerons pour confirmer la livraison à ${data.city}. Vous payez ${formatMAD(data.total)} en espèces à la réception. Gardez votre référence :`,
                ar: `سنتصل بك لتأكيد التوصيل إلى ${data.city}. ستدفع ${formatMAD(data.total)} نقدًا عند الاستلام. احتفظ بمرجعك:`,
              })}{' '}
              <strong className="font-medium text-ivory">{data.reference}</strong>.
            </p>

            <ul className="mt-12 divide-y divide-ivory/10 border-y border-ivory/10">
              {data.items.map((i, k) => (
                <li key={k} className="flex justify-between gap-4 py-4 text-[14px]">
                  <span className="text-ivory/85">
                    {i.name}
                    {i.variant && <span className="block text-[12px] text-ivory/45">{i.variant}</span>}
                    <span className="block text-[12px] text-ivory/45">
                      {i.quantity} × {formatMAD(i.unitPrice)}
                    </span>
                  </span>
                  <span className="text-ivory">{formatMAD(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between text-ivory/60">
                <dt>{t({ en: 'Subtotal', fr: 'Sous-total', ar: 'المجموع الفرعي' })}</dt>
                <dd>{formatMAD(data.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-ivory/60">
                <dt>{t({ en: 'Delivery', fr: 'Livraison', ar: 'التوصيل' })}</dt>
                <dd>{data.shipping ? formatMAD(data.shipping) : t({ en: 'Confirmed by phone', fr: 'Confirmée par téléphone', ar: 'يُؤكَّد بالهاتف' })}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-2">
                <dt className="label text-ivory/70">{t({ en: 'Total · cash on delivery', fr: 'Total · paiement à la livraison', ar: 'المجموع · الدفع عند الاستلام' })}</dt>
                <dd className="display text-4xl text-ivory">{formatMAD(data.total)}</dd>
              </div>
            </dl>
            <div className="mt-12 flex flex-wrap gap-4">
              <button onClick={() => go('/store')} className="label border border-gold/60 px-6 py-3 text-ivory hover:bg-gold/10">
                {t({ en: 'Back to the collection', fr: 'Retour à la collection', ar: 'العودة إلى المجموعة' })}
              </button>
              <button onClick={() => go('/#guembri')} className="label px-6 py-3 text-ivory/60 hover:text-ivory">
                {t({ en: 'Play the guembri', fr: 'Jouer du guembri', ar: 'اعزف على الكَمبري' })} <span className="inline-block rtl:-scale-x-100">→</span>
              </button>
            </div>
          </div>
        )}
      </StoreState>
    </div>
  )
}
