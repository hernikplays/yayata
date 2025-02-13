<template lang="pug">
div
  div(class='row justify-content-between align-items-center')
    div(class='col-lg-auto text-center')
      div(class='btn-group' role='group')
        button(class='btn btn-sm btn-outline-dark' type='button' v-on:click.prevent='selectPreviousWeek()')
          i(class='fa fa-angle-double-left')
          | &nbsp;Previous
        button(class='btn btn-sm btn-outline-dark disabled' type='button')
          | {{ date | moment('Wo [week of] YYYY') }}
        button(class='btn btn-sm btn-outline-dark' type='button' v-on:click.prevent='selectNextWeek()')
          | Next&nbsp;
          i(class='fa fa-angle-double-right')


    div(class='col-lg-auto text-center')
      hr(class='d-lg-none')

      div(class='btn-group' role='group')
        b-button(size='sm' variant='outline-dark' :pressed='showNoWork' v-on:click='setShowNoWork(true)') All days
        b-button(size='sm' variant='outline-dark' :pressed='!showNoWork' v-on:click='setShowNoWork(false)') Working days
        router-link(
          class="btn btn-sm btn-outline-dark"
          :to='{name: "calendar_month", params: { year: date.format("YYYY"), month: date.format("MM") } }'
        ) {{ date | moment('MMMM YYYY') }}
        router-link(
          v-if='moment(date).add(6, "day").format("YYYY-MM") != date.format("YYYY-MM")'
          class="btn btn-sm btn-outline-dark"
          :to='{name: "calendar_month", params: { year: moment(date).add(6, "day").format("YYYY"), month: moment(date).add(6, "day").format("MM") } }'
        ) {{ moment(date).add(6, "day") | moment('MMMM YYYY') }}

  hr

  b-modal(ref='performanceModal' hide-header=true hide-footer=true lazy=true size='lg')
    PerformanceWidget(
      :performance='selectedPerformance'
      :date='selectedDate'
      :duration='selectedDuration'
      v-on:success='onPerformanceModified()'
    )

  b-modal(ref='leaveModal' hide-header=true hide-footer=true lazy=true size='lg')
    LeaveWidget(
      :leave='selectedLeave'
      :date='selectedDate'
      v-on:success='onLeaveModified()'
    )

  b-modal(ref='attachmentModal' hide-header=true hide-footer=true lazy=true size='lg')
    AttachmentWidget(
      :leave='selectedLeave'
      v-on:success='onAttachmentModified()'
    )

  b-modal(ref='standbyModal' hide-header=true hide-footer=true lazy=true size='lg')
    StandbyWidget(
      :date='selectedDate'
      :performances='selectedStandby'
      v-on:success='onStandbyModified()'
    )

  b-modal(ref='whereaboutModal' hide-header=true hide-footer=true lazy=true size='lg')
    WhereaboutWidget(
      :date='selectedDate'
      :whereabout='selectedWhereabout'
      v-on:success='onWhereaboutModified()'
    )

  div(v-if='rangeInfo')
    div
      strong Total:&nbsp;
      | {{ rangeInfo.total_hours | round }} / {{ rangeInfo.work_hours | round }} hours

    hr

    div(class='calendar-row row')
      div(
        class='calendar-day col-md'
        v-for='(dayDetails, date) in sortByKey(rangeInfo.details)'
        v-bind:class="getCalendarDayClasses(date)"
      )
        div(class='card' :id='"calendar-day-" + date')
          div(class='card-header text-center') {{ date | moment('ddd, MMMM Do') }}

          div(class='card-text text-muted text-center' v-bind:style='getCalendarDayProgressStyle(date)')
            small
              strong {{ dayDetails.total_hours | round }}
              | &nbsp;/ {{ dayDetails.work_hours | round }} hours

          ul(class='list-group list-group-flush')
            //- Holidays
            li(class='list-group-item p-2' v-for='holiday in dayDetails.holidays')
              div(class='d-flex mb-0 justify-content-between')
                div {{ holiday.display_label }}
                div 🌐

            //- Leave
            template(v-for='leave in dayDetails.leaves' v-if='dayDetails.leaves')
              template(v-for='leave_date in leave.leavedate_set' v-if='isSameDay(leave_date.starts_at, date)')
                li(
                  class='list-group-item list-group-item-action cursor-pointer p-2'
                  v-on:click.prevent='((leave.status != "approved") && getTimesheetForDay(date)) ? editLeave(date, leave) : null'
                )
                  div(class='d-flex justify-content-between')
                    div {{ leave.leave_type.display_label }}
                    div(v-if='leave.status != "approved"' v-b-tooltip title='Pending leave') ❓🏖️
                    div(v-else v-b-tooltip title='Leave') 🏖️
                  div(class='d-flex justify-content-between')
                    div
                      div(class='text-muted')
                        small {{ leave_date.starts_at | moment('HH:mm') }} - {{ leave_date.ends_at | moment('HH:mm') }}
                      div(v-if='leave.description' class='text-muted')
                        small {{ leave.description }}
                    div
                      span(class='cursor-pointer' v-b-tooltip title='Attachments' v-on:click.stop='editAttachment(date, leave)')
                        small(v-if='leave.attachments.length') {{ leave.attachments.length }}
                        | 📎

            //- Whereabouts
            template(v-for='whereabout in whereabouts' v-if='whereabouts')
              li(
                class='list-group-item list-group-item-action p-2 cursor-pointer'
                v-if='isSameDay(whereabout.starts_at, date)'
                v-on:click.prevent='getTimesheetForDay(date) ? editWhereabout(date, whereabout) : null'
              )
                div(class='d-flex justify-content-between')
                  div {{ whereabout.location.display_label }}
                  div(v-b-tooltip title='Whereabout') 📍
                div(class='text-muted')
                  small {{ whereabout.starts_at | moment('HH:mm') }} - {{ whereabout.ends_at | moment('HH:mm') }}
                div(v-if='whereabout.description' class='text-muted')
                  small {{ whereabout.description }}

            //- Standby performance
            li(
              class='list-group-item list-group-item-action p-2 cursor-pointer'
              v-for='performance in dayDetails.standby_performances'
              v-on:click.prevent='getTimesheetForDay(date) ? editStandby(date) : null'
            )
              div(class='d-flex justify-content-between')
                div {{ performance.contract.display_label }}
                div(v-b-tooltip title='Standby / On-call') 💤

            //- Activity performance
            li(
              class='list-group-item list-group-item-action p-2 cursor-pointer'
              v-for='performance in dayDetails.activity_performances'
              v-on:click.prevent='getTimesheetForDay(date) ? editPerformance(date, performance) : null'
            )
              div(class='d-flex justify-content-between')
                div {{ performance.contract.display_label }}
                div {{ performance.duration | round }}h
              div(class='d-flex justify-content-between text-muted')
                small {{ performance.contract_role.display_label }}
                small {{ performance.performance_type.display_label }}
              div(v-if='performance.description' class='text-muted')
                vue-markdown(class='rendered-markdown' :source='performance.description')

          div(class='card-body p-0')

          div(class='card-footer')
            div(class='text-center')
              div(class='btn-group')
                button(class='btn btn-outline-dark btn-sm' @click='addPerformance(date)' v-b-tooltip="{boundary: 'window'}" title='Log performance')
                  | ⏳
                button(
                  v-if='supportContracts && supportContracts.length'
                  class='btn btn-outline-dark btn-sm'
                  v-b-tooltip="{boundary: 'window'}"
                  title='Standby / On-call'
                  @click='editStandby(date)'
                )
                  | 💤
                button(class='btn btn-outline-dark btn-sm' @click='addWhereabout(date)' v-b-tooltip="{boundary: 'window'}" title='Log whereabout')
                  | 📍
                button(class='btn btn-outline-dark btn-sm' @click='addLeave(date)' v-b-tooltip="{boundary: 'window'}" title='Request leave')
                  | 🏖️
</template>

<script>
import * as types from '../store/mutation-types';
import store from '../store';
import preferences from '../preferences'
import moment from 'moment';
import VueMarkdown from 'vue-markdown';
import PerformanceWidget from './widgets/PerformanceWidget.vue';
import StandbyWidget from './widgets/StandbyWidget.vue';
import WhereaboutWidget from './widgets/WhereaboutWidget.vue';
import LeaveWidget from './widgets/LeaveWidget.vue';
import AttachmentWidget from './widgets/AttachmentWidget.vue';

export default {
  name: 'Week',

  mixins: [],

  components: {
    VueMarkdown,
    PerformanceWidget,
    StandbyWidget,
    WhereaboutWidget,
    LeaveWidget,
    AttachmentWidget,
  },

  data () {
    return {
      date: null,
      weekDays: _.range(7).map(x => moment().day(x + 1).format('dddd')),
      rangeInfo: null,
      whereabouts: null,
      selectedPerformance: null,
      selectedStandby: null,
      selectedTimesheet: null,
      selectedDuration: null,
      selectedWhereabout: null,
      selectedLeave: null,
      selectedDay: null,
      selectedDate: null,
    }
  },

  watch: {
    '$route': function(to, from) {
      this.setDate()
      this.reloadData()
    },
  },

  created: function() {
    this.setDate()
    this.reloadData()

    new Promise((resolve, reject) => {
      if (!store.getters.open_timesheets) {
        store.dispatch(types.NINETOFIVER_RELOAD_TIMESHEETS).then(() => resolve())
      } else{
        resolve()
      }
    })

    new Promise((resolve, reject) => {
      if (!store.getters.active_contracts) {
        store.dispatch(types.NINETOFIVER_RELOAD_CONTRACTS).then(() => resolve())
      } else{
        resolve()
      }
    })
  },

  computed: {
    showNoWork: () => preferences.get(preferences.key.CALENDAR_SHOW_NO_WORK, true),

    supportContracts: function() {
      if (store.getters.active_contracts) {
        return store.getters.active_contracts.filter(contract => {
          return contract.type == 'SupportContract'
        })
      }
    },
  },

  methods: {
    setShowNoWork: function(state) {
      preferences.set(preferences.key.CALENDAR_SHOW_NO_WORK, state)
    },

    moment: function(args) {
      return moment(args)
    },

    sortByKey: function(obj) {
      let res = {}
      Object.keys(obj).sort().forEach(key => {
        res[key] = obj[key]
      })
      return res
    },

    selectNextWeek: function() {
      let new_date = moment(this.date).add(1, 'week')

      this.$router.push({
        name: 'calendar_week',
        params: {
          week: new_date.format('WW'),
          year: new_date.format('GGGG')
        }
      })
    },

    selectPreviousWeek: function() {
      let new_date = moment(this.date).subtract(1, 'week')

      this.$router.push({
        name: 'calendar_week',
        params: {
          week: new_date.format('WW'),
          year: new_date.format('GGGG')
        }
      })
    },

    setDate: function() {
      this.date = moment().isoWeekYear(this.$route.params.year).isoWeek(this.$route.params.week).startOf('isoWeek')
      if(this.$route.params.week > 52 && this.date.week() !== 53){
        this.$router.push({
          name: 'calendar_week',
          params: {
            week: this.date.week(),
            year: this.date.year()
          }
        })
      }
    },

    reloadData: function() {
      let start = moment(this.date).startOf('isoWeek')
      let end = moment(this.date).endOf('isoWeek')

      // Reload range info
      store.dispatch(types.NINETOFIVER_API_REQUEST, {
        path: '/range_info/',
        params: {
          'from': start.format('YYYY-MM-DD'),
          'until': end.format('YYYY-MM-DD'),
          'daily': true,
          'detailed': true
        }
      }).then(res => {
        this.rangeInfo = res.data
      })

      // Reload whereabouts
      store.dispatch(types.NINETOFIVER_API_REQUEST, {
        path: '/whereabouts/',
        params: {
          'starts_at__range': `${start.format('YYYY-MM-DDTHH:mm:ssZZ')},${end.format('YYYY-MM-DDTHH:mm:ssZZ')}`
        }
      }).then(res => {
        this.whereabouts = res.data.results
      })
    },

    isCurrentDay: function(val) {
      return moment().format('YYYY-MM-DD') == moment(val).format('YYYY-MM-DD')
    },

    isSameDay: function(valOne, valTwo) {
      return moment(valOne).format('YYYY-MM-DD') == moment(valTwo).format('YYYY-MM-DD')
    },

    isWorkingDay: function(val) {
      return this.rangeInfo.details[val].work_hours
    },

    isDayComplete: function(val) {
      return this.rangeInfo.details[val].remaining_hours === 0
    },

    getCalendarDayClasses: function(date) {
      let isComplete = this.isDayComplete(date)
      let isCurrent = this.isCurrentDay(date)
      let isWorking = this.isWorkingDay(date)

      return {
        'calendar-day-current': isCurrent,
        'calendar-day-nowork': !isWorking,
        'calendar-day-complete': isComplete,
        'calendar-day-incomplete': !isComplete,
        'calendar-day-hidden': (!isWorking && !this.showNoWork),
      }
    },

    getTimesheetForDay: function(date) {
      if (store.getters.open_timesheets) {
        return store.getters.open_timesheets.filter(timesheet => {
          return (timesheet.status == 'active') && (timesheet.year == moment(date).format('YYYY')) && (timesheet.month == moment(date).format('MM'))
        })[0]
      }
    },

    selectDay: function(date) {
      this.selectedTimesheet = this.getTimesheetForDay(date)
      this.selectedDay = moment(date).date()
      this.selectedDate = moment(date)
      this.selectedDuration = Math.round(this.rangeInfo.details[date].remaining_hours * 100) / 100
    },

    editStandby: function(date) {
      this.selectDay(date)
      this.selectedStandby = null
      this.$refs.standbyModal.show()
    },

    onStandbyModified: function() {
      this.$refs.standbyModal.hide()
      this.selectedStandby = null
      this.reloadData()
    },

    editPerformance: function(date, performance) {
      this.selectDay(date)
      this.selectedPerformance = performance
      this.$refs.performanceModal.show()
    },

    addPerformance: function(date) {
      this.selectDay(date)
      this.selectedPerformance = null
      this.$refs.performanceModal.show()
    },

    onPerformanceModified: function() {
      this.$refs.performanceModal.hide()
      this.selectedPerformance = null
      this.reloadData()
    },

    editWhereabout: function(date, whereabout) {
      this.selectDay(date)
      this.selectedWhereabout = whereabout
      this.$refs.whereaboutModal.show()
    },

    addWhereabout: function(date) {
      this.selectDay(date)
      this.selectedWhereabout = null
      this.$refs.whereaboutModal.show()
    },

    onWhereaboutModified: function() {
      this.$refs.whereaboutModal.hide()
      this.selectedWhereabout = null
      this.reloadData()
    },

    addLeave: function(date) {
      this.selectDay(date)
      this.selectedLeave = null
      this.$refs.leaveModal.show()
    },

    editLeave: function(date, leave) {
      this.selectDay(date)
      this.selectedLeave = leave
      this.$refs.leaveModal.show()
    },

    onLeaveModified: function() {
      this.$refs.leaveModal.hide()
      this.selectedLeave = null
      this.reloadData()
    },

    editAttachment: function(date, leave) {
      this.selectDay(date)
      this.selectedLeave = leave
      this.$refs.attachmentModal.show()
    },

    onAttachmentModified: function() {
      // this.$refs.attachmentModal.hide()
      // this.selectedLeave = null
      this.reloadData()
    },

    getCalendarDayProgressStyle: function(date) {
      let style = {}

      if (this.rangeInfo && this.rangeInfo.details) {
        let pct = (this.rangeInfo.details[date].total_hours / this.rangeInfo.details[date].work_hours) * 100
        pct = pct > 100 ? 100 : pct
        style['background'] = `linear-gradient(90deg, rgba(223, 255, 248, 0.75) 0%, rgba(223, 255, 248, 0.75) ${pct}%, rgba(255,255,255,0) ${pct}%, rgba(255,255,255,0) 100%)`
      }

      return style
    }
  },

  filters: {
    round: function(val) {
      return Math.round(val * 100) / 100
    },
  },
}
</script>

<style lang="less" scoped>
@calendar-day-padding: 5px;

.calendar-row {
  margin-left: -(@calendar-day-padding);
  margin-right: -(@calendar-day-padding);
}

.calendar-day {
  padding-bottom: @calendar-day-padding;
  padding-left: @calendar-day-padding;
  padding-right: @calendar-day-padding;

  .card {
    border-top-width: 3px;
  }

  @media all and (min-width: 768px) {
    // width: 14.2857%;
    // float: left;
    min-height: 3rem;
    overflow: auto;
    // display: block;

    .card {
      min-height: 30rem;
    }
  }

  &.calendar-day-hidden {
    display: none;
  }
}

.calendar-day-nowork {
  .card {
    opacity: 0.5;

    &:hover {
      opacity: 1;
    }
  }
}

.calendar-day-complete {
  .card {
    border-color: rgba(0, 215, 0, 0.5);
  }
}

.calendar-day-incomplete {
  .card {
    border-color: rgba(215, 0, 0, 0.5);
  }
}

.calendar-day-current {
  .card {
    background: repeating-linear-gradient(
      45deg,
      rgba(0, 215, 0, 0.25),
      rgba(0, 215, 0, 0.25) 10px,
      rgba(0, 215, 0, 0.1) 10px,
      rgba(0, 215, 0, 0.1) 20px
    );
  }
}
</style>
