<template lang="pug">
div(class='card card-top-blue mb-3')
  div(class='card-header text-center') 🏖️&nbsp;
    span(v-if='!model.id') Request leave
    span(v-else) Update leave
  div(class='card-body')
    b-alert(
      variant='warning'
      :show='!isFutureLeave()'
    )
      h5(class='alert-heading') You are not requesting leave in the future!
      | Please keep in mind that your request will receive additional review, since leave should only be requested for future dates under normal circumstances.<br>
      | Adding a description is highly recommended.<br>

    div(class='text-center')
      toggle-button(
        @change='toggleMultipleDays()',
        :value='model.multiple_days',
        :sync='true',
        :color={checked: '#f0ad4e', unchecked: '#5cb85c'},
        :labels={
          checked: 'Multiple days',
          unchecked: 'Single day'
        },
        :width='95',
      )

    vue-form-generator(:schema="schema" :model="model" :options="formOptions" v-bind:class='{ "single-day": !model.multiple_days, "multiple-days": model.multiple_days }')

    div(class='form-group')
      div(class='row justify-content-between')
        div(class='col')
          input(class='btn btn-primary' type="submit" value="Save" @click="submit()")
        div(class='col-auto' v-if='model.id')
          input(class='btn btn-danger' type="submit" value="Delete" @click="remove()")
</template>

<script>
import moment from 'moment-timezone';
import VueFormGenerator from 'vue-form-generator';
import toastr from 'toastr';
import * as types from '../../store/mutation-types';
import store from '../../store';
import utils from '../../utils';

var model = {
  id: null,
  leave_type: null,
  description: null,
  start_date: moment(),
  end_date: moment(),
  date: moment(),
  from_time: '09:00',
  until_time: null,
  multiple_days: false,
  status: 'draft',
  workHours:0
}
var submit = null
var dateSet = false
var startDateSet = false
var endDateSet = false

export default {
  name: 'LeaveWidget',

  mixins: [
  ],

  props: [
    'leave',
    'date',
  ],

  created: function() {
    submit = this.submit
    Promise.all([
      new Promise((resolve,reject)=>{
        // fetch work hours
        store.dispatch(types.NINETOFIVER_API_REQUEST, {
        path: '/range_availability/',
        params: {
          from: moment(moment.now()).format("YYYY-MM-DD"),
          until: moment(moment.now()).format("YYYY-MM-DD")
        }
      }).then((res) => {
        this.model.workHours = res.data[store.getters.user.id][moment(moment.now()).format("YYYY-MM-DD")]["work_hours"]
        this.resetForm()
      });
      }),
      new Promise((resolve, reject) => {
        if (!store.getters.leave_types) {
          store.dispatch(types.NINETOFIVER_RELOAD_LEAVE_TYPES).then(() => resolve())
        } else{
          resolve()
        }
      }),
    ]).then(() => {
      this.resetForm()
    })
  },

  methods: {
    toggleMultipleDays: function() {
      this.model.multiple_days = !this.model.multiple_days
    },

    resetForm: function() {
      if (this.leave) {
        this.model.id = this.leave.id
        this.model.description = this.leave.description
        this.model.leave_type = this.leave.leave_type.id
        this.model.multiple_days = this.leave.leavedate_set.length > 1
        this.model.date = moment(this.leave.leavedate_set[0].starts_at)
        this.model.start_date = moment(this.leave.leavedate_set[0].starts_at)
        this.model.end_date = moment(this.leave.leavedate_set[this.leave.leavedate_set.length - 1].ends_at)
        this.model.from_time = moment(this.leave.leavedate_set[0].starts_at).format('HH:mm')
        this.model.until_time = moment(this.leave.leavedate_set[this.leave.leavedate_set.length - 1].ends_at).format('HH:mm')
      } else {
        let date = this.date ? moment(this.date) : moment().add(1, 'days')

        this.model.id = null
        this.model.multiple_days = false
        this.model.leave_type = store.getters.leave_types[0].id
        this.model.description = null
        this.model.start_date = moment(date)
        this.model.end_date = moment(date)
        this.model.date = moment(date)
        this.model.from_time = '09:00'
        const fromHours = model.from_time.split(":")
        const toHour = Math.floor(parseInt(fromHours[0])+model.workHours)
        this.model.until_time = `${toHour < 10 ?`0${toHour}`:`${toHour}`}:${fromHours[1]}`
      }

      dateSet = false
      startDateSet = false
      endDateSet = false
    },

    submit: function() {
      if (this.loading) return
      this.loading = true

      let body = {
        leave_type: this.model.leave_type,
        description: this.model.description,
        status: this.model.status
      };
      let dt_format = 'YYYY-MM-DDTHH:mm:00ZZ'
      let timezone = moment.tz.guess()

      const send_leave_request = (body) => {
        store.dispatch(types.NINETOFIVER_API_REQUEST, {
          path: this.model.id ? `/leave/${this.model.id}/` : '/leave/',
          method: this.model.id ? 'PUT' : 'POST',
          body: body,
        }).then((response) => {
          this.$emit('success', response)
          toastr.success('Leave requested.')
          this.loading = false
          this.resetForm()
        }).catch((error) => {
          this.$emit('error', error)
          toastr.error('Error requesting leave.')

          try {
            for (var key in error.data) {
              error.data[key].forEach((err) => {
                toastr.error(err.message)
              })
            }
          } catch (err) {
          }

          this.loading = false
        });
      }

      if (this.model.multiple_days) {
        let start_date = moment(this.model.start_date).tz(timezone).startOf('date')
        let end_date = moment(this.model.end_date).tz(timezone).endOf('date')

        body.full_day = true
        body.starts_at = start_date.format(dt_format)
        body.ends_at = end_date.format(dt_format)
        // No need to check requested leave hours as this is calculated on the backend.
        send_leave_request(body)
      } else {
        let from_time = moment(this.model.from_time, "HH:mm")
        let until_time = moment(this.model.until_time, "HH:mm")

        let start_date = moment(this.model.date).tz(timezone).hour(from_time.hour()).minute(from_time.minute()).second(0)
        let end_date = moment(this.model.date).tz(timezone).hour(until_time.hour()).minute(until_time.minute()).second(0)

        // Get contract hours
        store.dispatch(types.NINETOFIVER_API_REQUEST, {
          path: '/range_info/',
          params: {
            'from': start_date.format('YYYY-MM-DD'),
            'until': end_date.format('YYYY-MM-DD'),
            'daily': true,
            'detailed': true
          }
        }).then(res => {
          // Error if requesting more leave hours than contract working hours.
          if (moment.duration(until_time.diff(from_time)) > res.data.work_hours * 60 * 60 * 1e3) {
            this.$emit('error', res)
            toastr.error('Cannot request leave for more hours than your contract hours.')
            this.loading = false
          }
          // Send the request when requesting a correct amount of leave hours.
          else {
            body.full_day = false
            body.starts_at = start_date.format(dt_format)
            body.ends_at = end_date.format(dt_format)

            send_leave_request(body)
          }
        })
      }
    },

    remove: function() {
      if (this.loading) return
      this.loading = true

      store.dispatch(types.NINETOFIVER_API_REQUEST, {
          path: `/leave/${this.model.id}/`,
          method: 'DELETE',
      }).then((response) => {
        this.$emit('success', response)
        toastr.success('Leave deleted.')
        this.loading = false
        this.resetForm()
      }).catch((error) => {
        this.$emit('error', error)
        toastr.error('Error deleting leave.')
        this.loading = false
      });
    },

    isFutureLeave: function() {
      return moment(this.model.multiple_days ? this.model.start_date : this.model.date).isAfter(moment(), 'day')
    },
  },

  data: () => {
    return {
      loading: false,

      model: model,

      schema: {
        fields: [
          {
            type: "pikaday",
            label: "Start date",
            model: "start_date",
            validator: [
              VueFormGenerator.validators.date,
              VueFormGenerator.validators.required
            ],
            pikadayOptions: {
              position: "top left",
              firstDay: 1,
              onDraw: function(pikaday) {
                if ((typeof model.start_date === 'object') && !startDateSet) {
                  startDateSet = true
                  pikaday.setDate(moment(model.start_date).toDate(), true)
                }
              },
              onSelect: function(value) {
                model.start_date = moment(value)

                if (moment(value).isAfter(moment(model.end_date))) {
                  model.end_date = moment(value)
                  endDateSet = false
                }
              },
            },
            // visible: function(model) {
            //   return model.multiple_days
            // },
            styleClasses: ['half-width-md', 'multiple-days-input']
          },
          {
            type: "pikaday",
            label: "End date",
            model: "end_date",
            validator: [
              VueFormGenerator.validators.date,
              VueFormGenerator.validators.required
            ],
            pikadayOptions: {
              position: "top left",
              firstDay: 1,
              onDraw: function(pikaday) {
                if (!pikaday._o.minDate || (moment(pikaday._o.minDate).format('YYYY-MM-DD') != moment(model.start_date).format('YYYY-MM-DD'))) {
                  pikaday.setMinDate(moment(model.start_date).toDate())
                }

                if ((typeof model.end_date === 'object') && !endDateSet) {
                  endDateSet = true
                  pikaday.setDate(moment(model.end_date).toDate(), true)
                }
              },
              onSelect: function(value) {
                model.end_date = moment(value)

                if (moment(value).isBefore(moment(model.start_date))) {
                  model.start_date = moment(value)
                  startDateSet = false
                }
              },
            },
            // visible: function(model) {
            //   return model.multiple_days
            // },
            styleClasses: ['half-width-md', 'multiple-days-input']
          },
          {
            type: "pikaday",
            label: "Date",
            model: "date",
            validator: [
              VueFormGenerator.validators.date,
              VueFormGenerator.validators.required
            ],
            pikadayOptions: {
              position: "top left",
              firstDay: 1,
              onDraw: function(pikaday) {
                if ((typeof model.date === 'object') && !dateSet) {
                  dateSet = true
                  pikaday.setDate(moment(model.date).toDate(), true)
                }
              },
            },
            // visible: function(model) {
            //   return !model.multiple_days
            // },
            styleClasses: ['third-width-md', 'single-day-input']
          },
          {
            type: "select",
            label: "From",
            model: "from_time",
            required: true,
            validator: VueFormGenerator.validators.time,
            values: utils.getTimeOptions().map(x => { return {id: x, name: x} }),
            styleClasses: ['a-width-md', 'single-day-input']
          },
          {
            type: "select",
            label: "Until",
            model: "until_time",
            required: true,
            validator: VueFormGenerator.validators.time,
            values: utils.getTimeOptions().map(x => { return {id: x, name: x} }),
            styleClasses: ['a-width-md', 'single-day-input'],
          },
          {
            type: "input",
            label: "1/2",
            model: "until_time",
            required: true,
            validator: VueFormGenerator.validators.time,
            values: utils.getTimeOptions().map(x => { return {id: x, name: x} }),
            styleClasses: ['b-width-md', 'single-day-input'],
            buttons:[
              {
                classes:"btn btn-primary fa fa-hourglass-end hourglass-end",
                onclick:(model)=>{
                  const fromHours = model.from_time.split(":")
                  const toHour = Math.floor(parseInt(fromHours[0])+(model.workHours/2))
                  model.until_time = `${toHour < 10 ?`0${toHour}`:`${toHour}`}:${fromHours[1]}`
                  
                }
              },
            ]
          },
          {
            type: "textArea",
            // label: "Description",
            placeholder: "Description", 
            model: "description",
            max: 255,
            rows: 2,
            validator: VueFormGenerator.validators.string
          },
          {
            type: "select",
            label: "Type",
            model: "leave_type",
            required: true,
            selectOptions: {
              value: "id",
              name: "display_label"
            },
            values: () => {
              if (store.getters.leave_types) {
                return store.getters.leave_types
              }

              return []
            },
            validator: VueFormGenerator.validators.required,
          },
          {
            type: "submit",
            buttonText: "Save",
            styleClasses: ["d-none"],
            validateBeforeSubmit: true,
            onSubmit: () => {
              submit()
            }
          }
        ]
      },

      formOptions: {
        validateAfterLoad: false,
        validateAfterChanged: true
      }
    }
  }
}
</script>

<style lang="less">
.multiple-days {
  .single-day-input {
    display: none;
  }
}

.single-day {
  .multiple-days-input {
    display: none;
  }
}

.btn {
    height: 37px;
}
</style>
