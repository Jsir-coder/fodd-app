const { createApp } = Vue;

createApp({
  data() {
    return {
      currentView: 'calendar', // 'calendar', 'ordering', 'detail'
      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth() + 1,
      selectedDateKey: '',
      selectedDate: '',
      selectedDishes: [],
      viewingOrder: null,
      orders: {},
      loading: false,
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],

      // 菜单配置 - 可扩展
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

      // 获取当月第一天和最后一天
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);

      // 获取当月第一天是星期几（0-6）
      const firstDayWeek = firstDay.getDay();

      // 获取当月天数
      const daysInMonth = lastDay.getDate();

      // 获取上个月的天数
      const prevMonthLastDay = new Date(year, month - 1, 0).getDate();

      const days = [];

      // 添加上个月的日期（补全第一周）
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

      // 添加当月的日期
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

      // 添加下个月的日期（补全最后一周）
      const remainingDays = 42 - days.length; // 6行 x 7列
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
    // 生成日期键 (YYYY-MM-DD)
    getDateKey(year, month, day) {
      // 处理跨月的情况
      const date = new Date(year, month - 1, day);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },

    // 格式化日期显示
    formatDate(dateKey) {
      const [year, month, day] = dateKey.split('-');
      return `${year}年${parseInt(month)}月${parseInt(day)}日`;
    },

    // 上一个月
    prevMonth() {
      if (this.currentMonth === 1) {
        this.currentMonth = 12;
        this.currentYear--;
      } else {
        this.currentMonth--;
      }
      this.loadOrders();
    },

    // 下一个月
    nextMonth() {
      if (this.currentMonth === 12) {
        this.currentMonth = 1;
        this.currentYear++;
      } else {
        this.currentMonth++;
      }
      this.loadOrders();
    },

    // 选择日期
    selectDate(day) {
      if (!day.isCurrentMonth) return;

      this.selectedDateKey = day.dateKey;
      this.selectedDate = this.formatDate(day.dateKey);

      if (day.hasOrder) {
        // 查看已有订单
        this.viewingOrder = [...day.dishes];
        this.currentView = 'detail';
      } else {
        // 新建订单
        this.selectedDishes = [];
        this.currentView = 'ordering';
      }
    },

    // 判断菜品是否已选
    isSelected(dish) {
      return this.selectedDishes.includes(dish);
    },

    // 切换菜品选择状态
    toggleDish(dish) {
      const index = this.selectedDishes.indexOf(dish);
      if (index > -1) {
        this.selectedDishes.splice(index, 1);
      } else {
        this.selectedDishes.push(dish);
      }
    },

    // 移除已选菜品
    removeDish(index) {
      this.selectedDishes.splice(index, 1);
    },

    // 取消点菜
    cancelOrdering() {
      this.currentView = 'calendar';
      this.selectedDishes = [];
    },

    // 确认订单
    async confirmOrder() {
      if (this.selectedDishes.length === 0) {
        alert('请至少选择一道菜');
        return;
      }

      this.loading = true;
      try {
        const response = await fetch(`/api/orders/${this.selectedDateKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dishes: this.selectedDishes })
        });

        const result = await response.json();
        if (result.success) {
          await this.loadOrders();
          this.currentView = 'calendar';
          this.selectedDishes = [];
        } else {
          alert('保存失败，请重试');
        }
      } catch (error) {
        console.error('保存订单失败:', error);
        alert('网络错误，请检查连接');
      } finally {
        this.loading = false;
      }
    },

    // 返回日历
    backToCalendar() {
      this.currentView = 'calendar';
      this.viewingOrder = null;
    },

    // 编辑订单
    editOrder() {
      this.selectedDishes = [...this.viewingOrder];
      this.currentView = 'ordering';
    },

    // 删除订单
    async deleteOrder() {
      if (!confirm('确定要删除这条点菜记录吗？')) {
        return;
      }

      this.loading = true;
      try {
        const response = await fetch(`/api/orders/${this.selectedDateKey}`, {
          method: 'DELETE'
        });

        const result = await response.json();
        if (result.success) {
          await this.loadOrders();
          this.currentView = 'calendar';
          this.viewingOrder = null;
        } else {
          alert('删除失败，请重试');
        }
      } catch (error) {
        console.error('删除订单失败:', error);
        alert('网络错误，请检查连接');
      } finally {
        this.loading = false;
      }
    },

    // 加载所有订单
    async loadOrders() {
      this.loading = true;
      try {
        const response = await fetch('/api/orders');
        this.orders = await response.json();
      } catch (error) {
        console.error('加载订单失败:', error);
      } finally {
        this.loading = false;
      }
    }
  },

  mounted() {
    this.loadOrders();

    // 定期刷新数据，确保多用户同步
    setInterval(() => {
      if (this.currentView === 'calendar') {
        this.loadOrders();
      }
    }, 5000); // 每5秒刷新一次
  }
}).mount('#app');
