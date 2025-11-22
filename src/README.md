# Egumeni Eats - Standalone PWA

A streamlined food ordering system for University of Mpumalanga.

## Recent Updates

### v2.1 - Email Service Removed (October 2025)
- ✅ Removed Resend API email service integration
- ✅ Deleted EmailTestPanel and ResendApiKeyGuide components
- ✅ Removed email service warnings from AdminDashboard
- ✅ Eliminated RESEND_API_KEY dependency issues
- ✅ Updated service worker cache to v2.1

### v2.0 - Payment Integrations Removed
- ✅ Removed all external payment gateway dependencies (Yoco, PayFast)
- ✅ Converted to localStorage-based ordering system
- ✅ Implemented standalone PWA architecture

## 🚀 Features

- **Role-based Authentication** - Customer, Admin, Kitchen, Delivery, Cashier, Stores
- **Clean Dashboard System** - Dedicated interfaces for each role
- **Supabase Integration** - Database and authentication
- **Modern UI** - University of Mpumalanga branding with Tailwind CSS

## 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Tailwind CSS v4
- **Backend**: Supabase + Edge Functions
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL via Supabase

## 🔧 Setup

### 1. Database Setup
Run this SQL in your Supabase SQL Editor:

```sql
-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT, -- Required by schema but handled by Supabase Auth
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT CHECK (role IN ('admin','customer','kitchen','delivery','cashier','stores')) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Create menu categories
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT
);

-- Create menu items
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now()
);

-- Create orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  order_type TEXT CHECK (order_type IN ('room_service','delivery','collection')) NOT NULL,
  status TEXT CHECK (status IN ('pending','preparing','ready','out_for_delivery','delivered','completed')) DEFAULT 'pending',
  room_number TEXT,
  delivery_address TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Create order items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  price NUMERIC(10,2) NOT NULL
);
```

### 2. Server Deployment
Deploy the Edge Function to Supabase:

```bash
supabase functions deploy make-server-7657fe8e
```

### 3. Environment Variables
Set these in Supabase Dashboard → Settings → Edge Functions:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key
- `SUPABASE_ANON_KEY`: Your anon public key

## 🎨 Brand Colors

University of Mpumalanga palette:
- **Navy Blue** (`#1e3a8a`) - Primary
- **Bright Blue** (`#2563eb`) - Secondary  
- **Orange** (`#f59e0b`) - Accent
- **Green** (`#10b981`) - Success
- **Red** (`#ef4444`) - Alerts

## 📱 User Roles

- **Customer**: Browse menu, place orders
- **Admin**: Full system management
- **Kitchen**: Order preparation and status updates
- **Delivery**: Delivery management and tracking
- **Cashier**: Point of sale operations
- **Stores**: Inventory and stock management

## 🚦 Getting Started

1. **Setup Database**: Run the SQL schema above
2. **Deploy Server**: Use the Supabase CLI
3. **Configure Environment**: Set the required variables
4. **Start Application**: Open in browser

The application will automatically handle authentication and route users to their appropriate dashboards.

## 🔧 Development

The project uses:
- React 18 with TypeScript
- Tailwind CSS v4 with custom UMP theme
- Supabase for backend services
- Clean, minimal architecture

---

**Built for University of Mpumalanga**