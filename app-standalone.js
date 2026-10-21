const { createApp } = Vue;

// 简单的云同步适配层 - 可以轻松切换到不同的云服务
class DataSync {
  constructor() {
    this.storageKey = 'food_orders';
    this.listeners = [];
    this.syncInterval = null;
    this.cloudEndpoint = null; // 可以配置云端API地址
  }

  // 初始化
  async init() {
    // 如果配置了云端地址，尝试同步
    if (this.cloudEndpoint) {
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

  // 保存到本地
  saveLocal(orders) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(orders));
      this.notifyListeners(orders);

      // 如果配置了云端，同步到云端
      if (this.cloudEndpoint) {
        this.syncToCloud(orders);
      }
    } catch (e) {
      console.error('保存本地数据失败:', e);
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

  // 同步到云端（可扩展）
  async syncToCloud(orders) {
    if (!this.cloudEndpoint) return;

    try {
      await fetch(this.cloudEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders })
      });
    } catch (e) {
      console.warn('云端同步失败:', e);
    }
  }

  // 从云端同步（可扩展）
  async syncFromCloud() {
    if (!this.cloudEndpoint) return;

    try {
      const response = await fetch(this.cloudEndpoint);
      const data = await response.json();
      if (data.orders) {
        localStorage.setItem(this.storageKey, JSON.stringify(data.orders));
        this.notifyListeners(data.orders);
      }
    } catch (e) {
      console.warn('从云端同步失败:', e);
    }
  }

  // 启动自动同步
  startAutoSync() {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      this.syncFromCloud();
    }, 5000); // 每5秒同步一次
  }

  // 停止自动同步
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // 配置云端地址（可以随时切换）
  setCloudEndpoint(endpoint) {
    this.cloudEndpoint = endpoint;
    this.syncFromCloud();
    this.startAutoSync();
  }
}

const dataSync = new DataSync();

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

      // 上个月
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

      // 当月
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

      // 下个月
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
      // 切换月份时刷新视图
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

    confirmOrder() {
      if (this.selectedDishes.length === 0) {
        alert('请至少选择一道菜');
        return;
      }

      const newOrders = { ...this.orders };
      newOrders[this.selectedDateKey] = {
        dishes: [...this.selectedDishes],
        timestamp: new Date().toISOString()
      };

      dataSync.saveLocal(newOrders);
      this.orders = newOrders;
      this.currentView = 'calendar';
      this.selectedDishes = [];
    },

    backToCalendar() {
      this.currentView = 'calendar';
      this.viewingOrder = null;
    },

    editOrder() {
      this.selectedDishes = [...this.viewingOrder];
      this.currentView = 'ordering';
    },

    deleteOrder() {
      if (!confirm('确定要删除这条点菜记录吗？')) {
        return;
      }

      const newOrders = { ...this.orders };
      delete newOrders[this.selectedDateKey];

      dataSync.saveLocal(newOrders);
      this.orders = newOrders;
      this.currentView = 'calendar';
      this.viewingOrder = null;
    },

    // 加载数据
    async loadOrders() {
      this.loading = true;
      try {
        this.orders = await dataSync.init();
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

    // 监听数据同步变化
    dataSync.onChange((orders) => {
      this.orders = orders;
    });

    // 如果想要连接到原来的本地服务器，取消下面这行注释
    // dataSync.setCloudEndpoint('http://localhost:3000/api/orders');

    // 或者连接到你部署的云服务器
    // dataSync.setCloudEndpoint('https://your-server.com/api/orders');
  }
}).mount('#app');
