import { addDays, subDays, startOfISOWeek, format, isAfter, isSameDay, isWeekend, isToday, compareAsc } from 'date-fns'

export const state = () => ({
  currentDate: new Date()
})

export const actions = {
  async addHoliday (context, payload) {
    const allDates = context.getters.getHolidayDates
    const newDates = [...allDates, payload].sort((accDate, currDate) => compareAsc(new Date(accDate), new Date(currDate)))
    const ref = this.$fire.firestore.collection('holidays').doc('6WuBEKz07eGilq2B8A3l')
    await ref.set({ dates: newDates })
    context.commit('setHolidays', newDates)
  }
}

export const mutations = {
  setToday (state) {
    state.currentDate = new Date()
  },
  nextWeek (state) {
    const startDate = startOfISOWeek(new Date(state.currentDate))
    state.currentDate = addDays(new Date(startDate), 7)
  },
  prevWeek (state) {
    const startDate = startOfISOWeek(new Date(state.currentDate))
    state.currentDate = subDays(new Date(startDate), 7)
  }
}

export const getters = {
  currentWeekLabel: (_, getters) => {
    const currentWeek = getters.currentWeek
    const firstDay = currentWeek[0]
    const lastDay = currentWeek[6]
    let label = format(firstDay.date, 'dd')
    if (firstDay.month !== lastDay.month) {
      label += ` ${format(firstDay.date, 'MMM')}`

      if (firstDay.year !== lastDay.year) {
        label += ` ${format(firstDay.date, 'yyyy')}`
      }
    }
    label += ` - ${format(lastDay.date, 'dd MMM yyyy')}`
    return label
  },
  /* eslint-disable @typescript-eslint/no-unused-vars */
  currentWeek: (state, getters, _, rootGetters) => {
    const startDate = startOfISOWeek(new Date(state.currentDate))
    const holidays = rootGetters['holidays/getHolidayDates']
    return [...Array(7)].map((_, index) => {
      const newDate = addDays(new Date(startDate), index)
      return {
        date: newDate,
        weekDay: format(newDate, 'EEEEEE'),
        monthDay: format(newDate, 'dd'),
        month: format(newDate, 'MMM'),
        year: format(newDate, 'yyyy'),
        isWeekend: isWeekend(newDate),
        isToday: isToday(newDate),
        isHoliday: holidays.some(date => isSameDay(new Date(date), newDate))
      }
    })
  },
  isNextweekInFuture: (_, getters) => {
    const { endDate } = getters.getcurrentWeekRange
    const today = new Date()
    return isAfter(endDate, today) || isSameDay(endDate, today)
  },
  getcurrentWeekRange: (_, getters) => {
    const currWeek = getters.currentWeek
    return { startDate: currWeek[0].date, endDate: currWeek[6].date }
  }
}
