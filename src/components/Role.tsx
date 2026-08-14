export type Role = 'restaurant' | 'rider' | 'client'

interface RoleProps {
  onSelect: (role: Role) => void
}

const roles: { id: Role; title: string; description: string }[] = [
  {
    id: 'restaurant',
    title: 'Restaurant',
    description: 'Sell your food, manage orders and grow your business.',
  },
  {
    id: 'rider',
    title: 'Rider',
    description: 'Deliver orders and earn on your own schedule.',
  },
  {
    id: 'client',
    title: 'Client',
    description: 'Order delicious meals from nearby restaurants.',
  },
]

export default function Role({ onSelect }: RoleProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <h1 className="text-center text-3xl font-semibold text-gray-900">
        How do you want to use Fun n Dine?
      </h1>
      <p className="mt-2 text-center text-gray-500">
        Choose your role to get started
      </p>

      <div className="mt-8 w-full max-w-md space-y-4">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => onSelect(role.id)}
            className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
          >
            <span className="block text-lg font-semibold text-gray-900">
              {role.title}
            </span>
            <span className="mt-1 block text-sm text-gray-500">
              {role.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
