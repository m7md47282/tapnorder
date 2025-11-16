import { BreakpointObserver, MediaMatcher } from '@angular/cdk/layout';
import { Component, OnInit, OnDestroy, ViewChild, ViewEncapsulation } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatSidenav, MatSidenavContent } from '@angular/material/sidenav';
import { CoreService } from 'src/app/services/core.service';

import { filter } from 'rxjs/operators';
import { NavigationEnd, Router } from '@angular/router';
import { NavService } from '../../services/nav.service';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { AppNavItemComponent } from './sidebar/nav-item/nav-item.component';
import { navItems } from './sidebar/sidebar-data';
import { AppTopstripComponent } from './top-strip/topstrip.component';
import { AuthService } from 'src/app/services/auth.service';
import { PermissionService } from 'src/app/services/permission.service';
import { NavItem } from './sidebar/nav-item/nav-item';
import { UserRole } from 'src/app/models/user.model';


const MOBILE_VIEW = 'screen and (max-width: 768px)';
const TABLET_VIEW = 'screen and (min-width: 769px) and (max-width: 1024px)';


@Component({
  selector: 'app-full',
  imports: [
    RouterModule,
    AppNavItemComponent,
    MaterialModule,
    CommonModule,
    SidebarComponent,
    NgScrollbarModule,
    TablerIconsModule,
    HeaderComponent,
  ],
  templateUrl: './full.component.html',
  styleUrls: ['./full.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class FullComponent implements OnInit, OnDestroy {
  navItems: NavItem[] = [];
  private userSubscription?: Subscription;

  @ViewChild('leftsidenav')
  public sidenav: MatSidenav;
  resView = false;
  @ViewChild('content', { static: true }) content!: MatSidenavContent;
  //get options from service
  options = this.settings.getOptions();
  private layoutChangesSubscription = Subscription.EMPTY;
  private isMobileScreen = false;
  private isContentWidthFixed = true;
  private isCollapsedWidthFixed = false;
  private htmlElement!: HTMLHtmlElement;

  get isOver(): boolean {
    return this.isMobileScreen;
  }


  constructor(
    private settings: CoreService,
    private router: Router,
    private breakpointObserver: BreakpointObserver,
    private authService: AuthService,
    private permissionService: PermissionService
  ) {
    this.htmlElement = document.querySelector('html')!;
    this.layoutChangesSubscription = this.breakpointObserver
      .observe([MOBILE_VIEW, TABLET_VIEW])
      .subscribe((state) => {
        // Don't auto-open sidebar on layout changes - respect user preference
        this.isMobileScreen = state.breakpoints[MOBILE_VIEW];
        // On mobile, sidebar should be closed by default
        if (this.isMobileScreen) {
          this.options.sidenavOpened = false;
        }
        // On tablet, if sidebar is open, consider collapsing it
        if (state.breakpoints[TABLET_VIEW] && this.options.sidenavOpened && !this.options.sidenavCollapsed) {
          this.options.sidenavCollapsed = true;
        }
      });

    // Initialize project theme with options


    // This is for scroll to top
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((e) => {
        this.content.scrollTo({ top: 0 });
      });
  }

  ngOnInit(): void {
    // Get initial user and set navigation
    const user = this.authService.getCurrentUser();
    if (user) {
      this.updateNavigation(user.role);
    }

    // Subscribe to user changes
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.updateNavigation(user.role);
      } else {
        this.navItems = [];
      }
    });
  }

  ngOnDestroy() {
    this.layoutChangesSubscription.unsubscribe();
    this.userSubscription?.unsubscribe();
  }

  private updateNavigation(role: UserRole): void {
    // Get role-based navigation
    const roleNav = this.permissionService.getRoleNavigation(role);
    
    // Build navigation items with sections
    const items: NavItem[] = [];
    
    // Home section (skip for chefs - they go directly to kitchen)
    if (role !== UserRole.CHEF) {
      items.push({ navCap: 'Home' });
      items.push({
        displayName: 'Dashboard',
        iconName: 'layout-grid-add',
        route: '/dashboard'
      });
    }

    // POS System section (if user has POS access)
    if (roleNav.some(n => n.route === '/pos')) {
      items.push({ navCap: 'POS System' });
      
      if (roleNav.some(n => n.route === '/pos')) {
        items.push({
          displayName: 'Point of Sale',
          iconName: 'shopping-cart',
          route: '/pos'
        });
      }
      
      if (roleNav.some(n => n.route === '/products')) {
        items.push({
          displayName: 'Products',
          iconName: 'package',
          route: '/products'
        });
      }
      
      if (roleNav.some(n => n.route === '/sales')) {
        items.push({
          displayName: 'Sales',
          iconName: 'receipt',
          route: '/sales'
        });
      }
      
      if (roleNav.some(n => n.route === '/customers')) {
        items.push({
          displayName: 'Customers',
          iconName: 'users',
          route: '/customers'
        });
      }
      
      if (roleNav.some(n => n.route === '/inventory')) {
        items.push({
          displayName: 'Inventory',
          iconName: 'database',
          route: '/inventory'
        });
      }
      
      if (roleNav.some(n => n.route === '/tables')) {
        items.push({
          displayName: 'Tables',
          iconName: 'table',
          route: '/tables'
        });
      }
      
      if (roleNav.some(n => n.route === '/reservations')) {
        items.push({
          displayName: 'Reservations',
          iconName: 'calendar',
          route: '/reservations'
        });
      }
      
      if (roleNav.some(n => n.route === '/kitchen')) {
        items.push({
          displayName: 'Kitchen Display',
          iconName: 'cooker',
          route: '/kitchen'
        });
      }
      
      if (roleNav.some(n => n.route === '/delivery')) {
        items.push({
          displayName: 'Delivery',
          iconName: 'truck',
          route: '/delivery'
        });
      }
      
      if (roleNav.some(n => n.route === '/menu')) {
        items.push({
          displayName: 'Guest Menu',
          iconName: 'menu-2',
          route: '/menu'
        });
      }
    }

    // Kitchen section
    if (roleNav.some(n => n.route === '/kitchen')) {
      items.push({ navCap: 'Kitchen' });
      items.push({
        displayName: 'Kitchen Display',
        iconName: 'chef-hat',
        route: '/kitchen'
      });
      items.push({
        displayName: 'Cookbook',
        iconName: 'book-2',
        route: '/kitchen/cookbook'
      });
    }

    // Reports section
    if (roleNav.some(n => n.route === '/reports')) {
      items.push({ navCap: 'Reports' });
      items.push({
        displayName: 'Reports',
        iconName: 'chart-bar',
        route: '/reports'
      });
    }

    // Finance section
    if (roleNav.some(n => n.route === '/accounting')) {
      items.push({ navCap: 'Finance' });
      items.push({
        displayName: 'Accounting',
        iconName: 'calculator',
        route: '/accounting'
      });
    }

    // HR section
    if (roleNav.some(n => n.route === '/hr')) {
      items.push({ navCap: 'Human Resources' });
      items.push({
        displayName: 'HR Management',
        iconName: 'users',
        route: '/hr'
      });
    }

    // Settings section
    if (roleNav.some(n => n.route === '/settings')) {
      items.push({ navCap: 'Settings' });
      items.push({
        displayName: 'Settings',
        iconName: 'settings',
        route: '/settings'
      });
    }

    this.navItems = items;
  }

  toggleCollapsed() {
    this.isContentWidthFixed = false;
    
    // If sidebar is closed, open it in collapsed state
    if (!this.options.sidenavOpened) {
      this.options.sidenavOpened = true;
      this.options.sidenavCollapsed = true;
      if (this.sidenav) {
        this.sidenav.open();
      }
    } else if (this.options.sidenavCollapsed) {
      // If sidebar is open and collapsed, expand it
      this.options.sidenavCollapsed = false;
    } else {
      // If sidebar is open and expanded, collapse it
      this.options.sidenavCollapsed = true;
    }
    
    this.resetCollapsedState();
  }
  
  closeSidebar() {
    if (this.sidenav) {
      this.sidenav.close();
    }
    this.options.sidenavOpened = false;
    this.settings.setOptions(this.options);
  }

  resetCollapsedState(timer = 400) {
    setTimeout(() => this.settings.setOptions(this.options), timer);
  }

  onSidenavClosedStart() {
    this.isContentWidthFixed = false;
  }

  onSidenavOpenedChange(isOpened: boolean) {
    this.isCollapsedWidthFixed = true;
    this.options.sidenavOpened = isOpened;
    this.settings.setOptions(this.options);
  }

}
