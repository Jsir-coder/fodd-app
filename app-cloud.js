const { createApp } = Vue;

// 云数据库适配器
class CloudDataSync {
  constructor() {
    this.storageKey = 'food_orders';
    this.listeners = [];
    this.syncInterval = null;
    this.useCloud = false;
    this.cloudType = 'deta'; // 'deta' | 'leancloud' | 'firebase'

    // 简易云存储配置（使用GitHub Gist作为免费云存储）
    this.gistId = localStorage.getItem('gist_id') || '';
    this.gistToken = localStorage.getItem('gist_token') || '';
  }

  async init() {
    // 检查是否配置了云存储
    if (this.gistId && this.gistToken) {
      this.useCloud = true;
      await this.syncFromCloud();
      this.startAutoSync();
    }
    return this.getLocal();
  }

  // 获取本地数据
  getLocal() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('读取本地数据失败:', e);
      return {};
    }
  }

  // 保存到本地和云端
  async save(orders) {
    try {
      // 保存到本地
      localStorage.setItem(this.storageKey, JSON.stringify(orders));
      this.notifyListeners(orders);

      // 保存到云端
      if (this.useCloud) {
        await this.syncToCloud(orders);
      }

      return true;
    } catch (e) {
      console.error('保存数据失败:', e);
      return false;
    }
  }

  // 监听数据变化
  onChange(callback) {
    this.listeners.push(callback);
  }

  // 通知监听者
  notifyListeners(orders) {
    this.listeners.forEach(callback => callback(orders));
  }

  // 同步到云端 - 使用 GitHub Gist
  async syncToCloud(orders) {
    if (!this.gistId || !this.gistToken) return;

    try {
      const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${this.gistToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: {
            'food-orders.json': {
              content: JSON.stringify(orders, null, 2)
            }
          }
        })
      });

      if (!response.ok) {
        console.warn('云端同步失败');
      }
    } catch (e) {
      console.warn('云端同步失败:', e);
    }
  }

  // 从云端同步
  async syncFromCloud() {
    if (!this.gistId || !this.gistToken) return;

    try {
      const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
        headers: {
          'Authorization': `token ${this.gistToken}`,
        }
      });

      if (response.ok) {
        const gist = await response.json();
        const fileContent = gist.files['food-orders.json']?.content;

        if (fileContent) {
          const orders = JSON.parse(fileContent);
          localStorage.setItem(this.storageKey, JSON.stringify(orders));
          this.notifyListeners(orders);
        }
      }
    } catch (e) {
      console.warn('从云端同步失败:', e);
    }
  }

  // 启动自动同步
  startAutoSync() {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(async () => {
      await this.syncFromCloud();
    }, 10000); // 每10秒同步一次
  }

  // 停止自动同步
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // 创建新的 Gist（首次使用）
  async createGist(token) {
    try {
      const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: '点菜小程序数据存储',
          public: false,
          files: {
            'food-orders.json': {
              content: JSON.stringify({}, null, 2)
            }
          }
        })
      });

      if (response.ok) {
        const gist = await response.json();
        return gist.id;
      }
      return null;
    } catch (e) {
      console.error('创建Gist失败:', e);
      return null;
    }
  }
}

const cloudDataSync = new CloudDataSync();

createApp({
  data() {
    return {
      currentView: 'calendar',
      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth() + 1,
      selectedDateKey: '',
      selectedDate: '',
      selectedDishes: [],
      viewingOrder: null,
      orders: {},
      loading: false,
      loadingText: '加载中...',
      syncStatus: '📱 本地存储模式',
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],

      menuCategories: [
        {
          name: '汤品',
          icon: '🍲',
          dishes: ['紫菜汤', '佛手瓜肉丝蛋汤', '菠菜蛋花汤']
        },
        {
          name: '主食',
          icon: '🍜',
          dishes: ['炒年糕', '炒米线', '饺子', '蛋炒饭']
        },
        {
          name: '小炒',
          icon: '🥘',
          dishes: ['芹菜炒牛肉', '韭黄炒蛋']
        },
        {
          name: '大餐',
          icon: '🍖',
          dishes: ['芋头煲', '蒜蓉粉丝虾', '酸菜鱼', '板栗炖鸡']
        }
      ]
    };
  },

  computed: {
    years() {
      const currentYear = new Date().getFullYear();
      return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
    },

    calendarDays() {
      const year = this.currentYear;
      const month = this.currentMonth;
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      const firstDayWeek = firstDay.getDay();
      const daysInMonth = lastDay.getDate();
      const prevMonthLastDay = new Date(year, month - 1, 0).getDate();

      const days = [];

      for (let i = firstDayWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        const dateKey = this.getDateKey(year, month - 1, day);
        days.push({
          day,
          dateKey,
          isCurrentMonth: false,
          isToday: false,
          hasOrder: !!this.orders[dateKey],
          dishes: this.orders[dateKey]?.dishes || [],
          key: `prev-${day}`
        });
      }

      const today = new Date();
      const todayStr = this.getDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());

      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = this.getDateKey(year, month, day);
        days.push({
          day,
          dateKey,
          isCurrentMonth: true,
          isToday: dateKey === todayStr,
          hasOrder: !!this.orders[dateKey],
          dishes: this.orders[dateKey]?.dishes || [],
          key: `current-${day}`
        });
      }

      const remainingDays = 42 - days.length;
      for (let day = 1; day <= remainingDays; day++) {
        const dateKey = this.getDateKey(year, month + 1, day);
        days.push({
          day,
          dateKey,
          isCurrentMonth: false,
          isToday: false,
          hasOrder: !!this.orders[dateKey],
          dishes: this.orders[dateKey]?.dishes || [],
          key: `next-${day}`
        });
      }

      return days;
    }
  },

  methods: {
    getDateKey(year, month, day) {
      const date = new Date(year, month - 1, day);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },

    formatDate(dateKey) {
      const [year, month, day] = dateKey.split('-');
      return `${year}年${parseInt(month)}月${parseInt(day)}日`;
    },

    prevMonth() {
      if (this.currentMonth === 1) {
        this.currentMonth = 12;
        this.currentYear--;
      } else {
        this.currentMonth--;
      }
    },

    nextMonth() {
      if (this.currentMonth === 12) {
        this.currentMonth = 1;
        this.currentYear++;
      } else {
        this.currentMonth++;
      }
    },

    changeMonth() {
      this.$forceUpdate();
    },

    selectDate(day) {
      if (!day.isCurrentMonth) return;

      this.selectedDateKey = day.dateKey;
      this.selectedDate = this.formatDate(day.dateKey);

      if (day.hasOrder) {
        this.viewingOrder = [...day.dishes];
        this.currentView = 'detail';
      } else {
        this.selectedDishes = [];
        this.currentView = 'ordering';
      }
    },

    isSelected(dish) {
      return this.selectedDishes.includes(dish);
    },

    toggleDish(dish) {
      const index = this.selectedDishes.indexOf(dish);
      if (index > -1) {
        this.selectedDishes.splice(index, 1);
      } else {
        this.selectedDishes.push(dish);
      }
    },

    removeDish(index) {
      this.selectedDishes.splice(index, 1);
    },

    cancelOrdering() {
      this.currentView = 'calendar';
      this.selectedDishes = [];
    },

    async confirmOrder() {
      if (this.selectedDishes.length === 0) {
        alert('请至少选择一道菜');
        return;
      }

      this.loading = true;
      this.loadingText = '保存中...';

      const newOrders = { ...this.orders };
      newOrders[this.selectedDateKey] = {
        dishes: [...this.selectedDishes],
        timestamp: new Date().toISOString()
      };

      const success = await cloudDataSync.save(newOrders);

      if (success) {
        this.orders = newOrders;
        this.currentView = 'calendar';
        this.selectedDishes = [];
      } else {
        alert('保存失败，请重试');
      }

      this.loading = false;
    },

    backToCalendar() {
      this.currentView = 'calendar';
      this.viewingOrder = null;
    },

    editOrder() {
      this.selectedDishes = [...this.viewingOrder];
      this.currentView = 'ordering';
    },

    async deleteOrder() {
      if (!confirm('确定要删除这条点菜记录吗？')) {
        return;
      }

      this.loading = true;
      this.loadingText = '删除中...';

      const newOrders = { ...this.orders };
      delete newOrders[this.selectedDateKey];

      const success = await cloudDataSync.save(newOrders);

      if (success) {
        this.orders = newOrders;
        this.currentView = 'calendar';
        this.viewingOrder = null;
      } else {
        alert('删除失败，请重试');
      }

      this.loading = false;
    },

    async loadOrders() {
      this.loading = true;
      this.loadingText = '加载数据...';

      try {
        this.orders = await cloudDataSync.init();

        // 更新同步状态
        if (cloudDataSync.useCloud) {
          this.syncStatus = '☁️ 云同步已启用';
        } else {
          this.syncStatus = '📱 本地存储模式';
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        this.loading = false;
      }
    }
  },

  async mounted() {
    await this.loadOrders();

    // 监听其他标签页的变化
    window.addEventListener('storage', (e) => {
      if (e.key === 'food_orders' && e.newValue) {
        this.orders = JSON.parse(e.newValue);
      }
    });

    // 监听云同步数据变化
    cloudDataSync.onChange((orders) => {
      this.orders = orders;
    });
  },

  beforeUnmount() {
    cloudDataSync.stopAutoSync();
  }
}).mount('#app');
