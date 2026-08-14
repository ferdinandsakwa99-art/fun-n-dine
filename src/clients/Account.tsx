interface AccountProps {
  onLogin?: () => void
  onSignup?: () => void
  onPartner?: () => void
  onBack?: () => void
}

export default function Account({
  onLogin,
  onSignup,
  onPartner,
  onBack,
}: AccountProps) {
  return (
    <div className="min-h-svh bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Account</h1>
            <p className="mt-1 text-sm text-gray-500">
              Log in or create an account to get started.
            </p>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Back
            </button>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <button
            type="button"
            onClick={onLogin}
            className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
          >
            <span className="block text-lg font-semibold text-gray-900">
              Log in
            </span>
            <span className="mt-1 block text-sm text-gray-500">
              Order meals with your existing account
            </span>
          </button>

          <button
            type="button"
            onClick={onSignup}
            className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
          >
            <span className="block text-lg font-semibold text-gray-900">
              Create account
            </span>
            <span className="mt-1 block text-sm text-gray-500">
              Sign up to order delicious meals
            </span>
          </button>

          <button
            type="button"
            onClick={onPartner}
            className="w-full rounded-2xl border border-purple-200 bg-purple-50 p-5 text-left shadow-sm transition hover:border-purple-400 hover:shadow-md"
          >
            <span className="block text-lg font-semibold text-purple-900">
              Partner with us
            </span>
            <span className="mt-1 block text-sm text-purple-700">
              Sign up or log in as a restaurant
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
