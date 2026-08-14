import { useEffect, useState } from 'react'
import splash1 from '../assets/splash1.png'
import splash2 from '../assets/splash2.png'
import splash3 from '../assets/splash3.png'

const images = [splash1, splash2, splash3]

interface SplashProps {
  onFinish: () => void
}

export default function Splash({ onFinish }: SplashProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % images.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="fixed inset-0 z-50 h-svh w-full overflow-hidden bg-black">
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2">
        {images.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === index ? 'w-6 bg-white' : 'w-2 bg-white/40'
            }`}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onFinish}
        className="absolute bottom-8 right-8 rounded-full bg-white/90 px-5 py-2 text-sm font-semibold text-gray-900 shadow-lg transition hover:bg-white"
      >
        Skip
      </button>
    </div>
  )
}
