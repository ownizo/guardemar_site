import { Car, CloudRain, KeyRound, Mail, Package, PhoneCall, Plane, Shirt, ShoppingBasket, Sparkles, Trees, Wrench, type LucideIcon } from 'lucide-react'
import { optionalServiceGroups, optionalServicesInGroup, type OptionalService, type OptionalServiceIcon } from '@/config/optional-services'

const icons = {
  mail: Mail,
  shopping: ShoppingBasket,
  plane: Plane,
  sparkles: Sparkles,
  shirt: Shirt,
  wrench: Wrench,
  package: Package,
  car: Car,
  trees: Trees,
  key: KeyRound,
  phone: PhoneCall,
  storm: CloudRain,
} satisfies Record<OptionalServiceIcon, LucideIcon>

export function ServiceIcon({ name }: { name: OptionalServiceIcon }) {
  const Icon = icons[name]
  return <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
}

function OptionalServiceCard({ service, showPrice }: { service: OptionalService; showPrice: boolean }) {
  return (
    <article className="optional-card">
      <span className="optional-card-icon"><ServiceIcon name={service.icon} /></span>
      <h4>{service.name}</h4>
      <p>{service.description}</p>
      {showPrice ? (
        <p className="optional-price">
          <strong>{service.fee}</strong>
          {service.extraCost ? <span>{service.extraCost}</span> : null}
        </p>
      ) : null}
    </article>
  )
}

export function OptionalServicesCatalogue({
  showPrice,
  eyebrow = 'Additional services',
  title = 'More ways to look after your home while you are away.',
  intro,
  headingId,
}: {
  showPrice: boolean
  eyebrow?: string
  title?: string
  intro?: string
  headingId?: string
}) {
  return (
    <div className="optional-catalogue">
      <header className="optional-services-intro">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={headingId}>{title}</h2>
        {intro ? <p>{intro}</p> : null}
      </header>
      {optionalServiceGroups.map((group) => (
        <section className="optional-group" key={group.id} aria-labelledby={`optional-group-${group.id}`}>
          <h3 id={`optional-group-${group.id}`}>{group.heading}</h3>
          <p className="optional-group-text">{group.text}</p>
          <div className={`optional-grid optional-grid-${group.serviceIds.length}`}>
            {optionalServicesInGroup(group).map((service) => (
              <OptionalServiceCard key={service.id} service={service} showPrice={showPrice} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
