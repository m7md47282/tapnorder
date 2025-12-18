import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  {
    navCap: 'Home',
  },
  {
    displayName: 'Dashboard',
    iconName: 'layout-grid-add',
    route: '/dashboard',
  },
  {
    displayName: 'AI Business Advisor',
    iconName: 'psychology',
    route: '/dashboard/ai-advisor',
  },
  {
    navCap: 'POS System',
  },
  {
    displayName: 'Point of Sale',
    iconName: 'shopping-cart',
    route: '/pos',
  },
  {
    displayName: 'Tables',
    iconName: 'table',
    route: '/tables',
  },
  {
    displayName: 'Products',
    iconName: 'package',
    route: '/products',
  },
  {
    displayName: 'Sales',
    iconName: 'receipt',
    route: '/sales',
  },
  {
    displayName: 'Customers',
    iconName: 'users',
    route: '/customers',
  },
  {
    displayName: 'Inventory',
    iconName: 'database',
    route: '/inventory',
  },
  {
    displayName: 'Addon Groups',
    iconName: 'apps',
    route: '/addons',
  },
  {
    displayName: 'Reports',
    iconName: 'chart-bar',
    route: '/reports',
  },
  {
    displayName: 'Settings',
    iconName: 'settings',
    route: '/settings',
  },
  {
    navCap: 'Finance',
  },
  {
    displayName: 'Accounting',
    iconName: 'calculator',
    route: '/accounting',
  },
  {
    navCap: 'Human Resources',
  },
  {
    displayName: 'HR Management',
    iconName: 'users',
    route: '/hr',
  },
  {
    navCap: 'Kitchen',
  },
  {
    displayName: 'Kitchen Display',
    iconName: 'chef-hat',
    route: '/kitchen',
  },
  {
    displayName: 'Cookbook',
    iconName: 'book-2',
    route: '/kitchen/cookbook',
  },
  {
    navCap: 'Auth',
  },
  {
    displayName: 'Login',
    iconName: 'login',
    route: '/authentication/login',
  },
  {
    displayName: 'Register',
    iconName: 'user-plus',
    route: '/authentication/register',
  },
];
