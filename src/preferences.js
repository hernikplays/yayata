import store from './store'
import * as types from './store/mutation-types'

const key = {
    CALENDAR_SHOW_NO_WORK: 'calendar_show_no_work',
    CALENDAR_SHOW_TIMESHEET_WIDGET: 'calendar_show_timesheet_widget',
    PERFORMANCE_SELECTED_CONTRACT_ID: 'performance_selected_contract_id',
    WHEREABOUT_SELECTED_LOCATION_ID: 'whereabout_selected_location_id',
    SHOW_UPDATED_NOTIFICATION: 'show_updated_notification',
    STANDBY_SELECTED_CONTRACT_ID:'standby_selected_contract_id'
}


const set = (key, value) => {
    store.commit(types.PREFERENCES_SET_KEY, {
        key: key,
        value: value
    })
}

const get = (key, defaultValue = null) => {
    if (store.getters.preferences[key] === undefined) {
        return defaultValue
    }

    return store.getters.preferences[key]
}


export default {
    set,
    get,
    key,
}
