import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { getStoredJSON, setStoredJSON, removeStored } from './lib/storage'
import { syncLocalCartToServer } from './lib/cartStore'
import ClientAccount from './clients/Account'
import ChefSignup from './chefs/Signup'
import ChefLogin from './chefs/Login'
import ChefHome from './chefs/Home'
import ChefRestaurant from './chefs/Restaurant'
import ChefRestaurantDetail from './chefs/RestaurantDetail'
import ChefRestaurantManage from './chefs/RestaurantManage'
import ChefMenu from './chefs/Menu'
import ChefMenuItems from './chefs/MenuItems'
import ChefOrders from './chefs/Orders'
import ChefOrderDetails from './chefs/OrderDetails'
import ChefEarnings from './chefs/Earnings'
import ChefProfile from './chefs/Profile'
import ChefSettings from './chefs/Settings'
import ClientSignup from './clients/Signup'
import ClientLogin from './clients/Login'
import ClientHome from './clients/Home'
import ClientRestaurantDetail from './clients/RestaurantDetail'
import ClientProductDetails from './clients/ProductDetails'
import ClientCart from './clients/Cart'
import ClientProfile from './clients/Profile'
import ClientCheckout from './clients/Checkout'
import ClientOrderDetails from './clients/OrderDetails'
import RiderSignup from './riders/Signup'
import RiderLogin from './riders/Login'
import RiderHome from './riders/Home'
import type { Role as RoleName } from './components/Role'
import './App.css'

type Screen =
  | RoleName
  | 'chef-login'
  | 'chef-home'
  | 'chef-restaurant'
  | 'chef-restaurant-detail'
  | 'chef-restaurant-manage'
  | 'chef-menu'
  | 'chef-menu-items'
  | 'chef-orders'
  | 'chef-order-details'
  | 'chef-earnings'
  | 'chef-profile'
  | 'chef-settings'
  | 'client-login'
  | 'client-home'
  | 'client-account'
  | 'client-restaurant'
  | 'client-product-details'
  | 'client-cart'
  | 'client-profile'
  | 'client-checkout'
  | 'client-order-details'
  | 'rider-login'
  | 'rider-home'

const SELECTED_RESTAURANT_KEY = 'chef:selected-restaurant'

interface RestaurantRef {
  id: string
  name: string
}

function App() {
  const [screen, setScreen] = useState<Screen>('client-home')
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantRef | null>(
    () => getStoredJSON<RestaurantRef | null>(SELECTED_RESTAURANT_KEY, null),
  )
  const [selectedCategory, setSelectedCategory] = useState<{
    id: string
    name: string
  } | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedMenuItem, setSelectedMenuItem] = useState<{
    id: string
    name: string
  } | null>(null)
  const [restaurantManageBack, setRestaurantManageBack] = useState<Screen>(
    'chef-settings',
  )
  const [orderDetailsBack, setOrderDetailsBack] = useState<Screen>('chef-home')

  useEffect(() => {
    if (selectedRestaurant) {
      setStoredJSON(SELECTED_RESTAURANT_KEY, selectedRestaurant)
    } else {
      removeStored(SELECTED_RESTAURANT_KEY)
    }
  }, [selectedRestaurant])

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void syncLocalCartToServer()
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <>
      {screen === 'restaurant' && (
        <ChefSignup onLogin={() => setScreen('chef-login')} />
      )}
      {screen === 'chef-login' && (
        <ChefLogin
          onSignup={() => setScreen('restaurant')}
          onSuccess={() => setScreen('chef-home')}
        />
      )}
      {screen === 'chef-home' && (
        <ChefHome
          onNavigate={(page) => setScreen(`chef-${page}` as Screen)}
          onSelectOrder={(orderId) => {
            setOrderDetailsBack('chef-home')
            setSelectedOrderId(orderId)
            setScreen('chef-order-details')
          }}
        />
      )}
      {screen === 'chef-restaurant' && (
        <ChefRestaurant
          onBack={() => setScreen('chef-home')}
          onSelect={(restaurant) => {
            setSelectedRestaurant(restaurant)
            setScreen('chef-restaurant-detail')
          }}
        />
      )}
      {screen === 'chef-restaurant-detail' &&
        selectedRestaurant && (
          <ChefRestaurantDetail
            restaurant={selectedRestaurant}
            onBack={() => setScreen('chef-restaurant')}
            onNavigate={(page) => {
              if (page === 'menu') {
                setScreen('chef-menu')
              } else if (page === 'profile') {
                setRestaurantManageBack('chef-restaurant-detail')
                setScreen('chef-restaurant-manage')
              } else {
                setScreen('chef-settings')
              }
            }}
          />
        )}
      {screen === 'chef-restaurant-manage' && selectedRestaurant && (
        <ChefRestaurantManage
          restaurantId={selectedRestaurant.id}
          onBack={() => setScreen(restaurantManageBack)}
          onSaved={() => setScreen(restaurantManageBack)}
        />
      )}
      {screen === 'chef-menu' && (
        <ChefMenu
          onBack={() => setScreen('chef-home')}
          onSelectCategory={(category) => {
            setSelectedCategory(category)
            setScreen('chef-menu-items')
          }}
        />
      )}
      {screen === 'chef-menu-items' && selectedCategory && (
        <ChefMenuItems
          category={selectedCategory}
          restaurant={selectedRestaurant}
          onBack={() => setScreen('chef-menu')}
        />
      )}
      {screen === 'chef-orders' && (
        <ChefOrders
          onBack={() => setScreen('chef-home')}
          onSelectOrder={(orderId) => {
            setOrderDetailsBack('chef-orders')
            setSelectedOrderId(orderId)
            setScreen('chef-order-details')
          }}
        />
      )}
      {screen === 'chef-order-details' && selectedOrderId && (
        <ChefOrderDetails
          orderId={selectedOrderId}
          onBack={() => setScreen(orderDetailsBack)}
        />
      )}
      {screen === 'chef-profile' && (
        <ChefProfile onBack={() => setScreen('chef-home')} />
      )}
      {screen === 'chef-earnings' && (
        <ChefEarnings onBack={() => setScreen('chef-home')} />
      )}
      {screen === 'chef-settings' && (
        <ChefSettings
          onBack={() => setScreen('chef-home')}
          onLogout={() => {
            setSelectedRestaurant(null)
            setSelectedCategory(null)
            setScreen('client-home')
          }}
          onManageRestaurant={(restaurant) => {
            setSelectedRestaurant(restaurant)
            setRestaurantManageBack('chef-settings')
            setScreen('chef-restaurant-manage')
          }}
          onOpenRestaurants={() => setScreen('chef-restaurant')}
        />
      )}
      {screen === 'client' && (
        <ClientSignup onLogin={() => setScreen('client-login')} />
      )}
      {screen === 'client-login' && (
        <ClientLogin
          onSignup={() => setScreen('client')}
          onSuccess={() => setScreen('client-home')}
        />
      )}
      {screen === 'client-home' && (
        <ClientHome
          onSelectRestaurant={(restaurant) => {
            setSelectedRestaurant(restaurant)
            setScreen('client-restaurant')
          }}
          onSelectItem={(item) => {
            setSelectedMenuItem(item)
            setScreen('client-product-details')
          }}
          onOpenCart={() => setScreen('client-cart')}
          onOpenProfile={() => {
            void supabase.auth.getSession().then(({ data }) => {
              setScreen(data.session ? 'client-profile' : 'client-account')
            })
          }}
        />
      )}
      {screen === 'client-account' && (
        <ClientAccount
          onBack={() => setScreen('client-home')}
          onLogin={() => setScreen('client-login')}
          onSignup={() => setScreen('client')}
          onPartner={() => setScreen('restaurant')}
        />
      )}
      {screen === 'client-restaurant' && selectedRestaurant && (
        <ClientRestaurantDetail
          restaurant={selectedRestaurant}
          onBack={() => setScreen('client-home')}
          onSelectItem={(item) => {
            setSelectedMenuItem(item)
            setScreen('client-product-details')
          }}
        />
      )}
      {screen === 'client-product-details' && selectedMenuItem && (
        <ClientProductDetails
          itemId={selectedMenuItem.id}
          onBack={() => setScreen('client-home')}
        />
      )}
      {screen === 'client-cart' && (
        <ClientCart
          onBack={() => setScreen('client-home')}
          onCheckout={() => setScreen('client-checkout')}
        />
      )}
      {screen === 'client-profile' && (
        <ClientProfile
          onBack={() => setScreen('client-home')}
          onLogout={() => {
            setSelectedRestaurant(null)
            setSelectedCategory(null)
            setScreen('client-home')
          }}
          onSelectOrder={(orderId) => {
            setSelectedOrderId(orderId)
            setScreen('client-order-details')
          }}
        />
      )}
      {screen === 'client-order-details' && selectedOrderId && (
        <ClientOrderDetails
          orderId={selectedOrderId}
          onBack={() => setScreen('client-profile')}
        />
      )}
      {screen === 'client-checkout' && (
        <ClientCheckout
          onBack={() => setScreen('client-cart')}
          onPlaced={() => setScreen('client-home')}
          onSignIn={() => setScreen('client-account')}
        />
      )}
      {screen === 'rider' && (
        <RiderSignup onLogin={() => setScreen('rider-login')} />
      )}
      {screen === 'rider-login' && (
        <RiderLogin
          onSignup={() => setScreen('rider')}
          onSuccess={() => setScreen('rider-home')}
        />
      )}
      {screen === 'rider-home' && (
        <RiderHome
          onLogout={() => {
            setSelectedRestaurant(null)
            setSelectedCategory(null)
            setScreen('client-home')
          }}
        />
      )}
    </>
  )
}

export default App
