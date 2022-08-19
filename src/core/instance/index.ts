import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'
import type { GlobalAPI } from 'types/global-api'

function Vue(options) {
  if (__DEV__ && !(this instanceof Vue)) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 生产环境 不 new 也行
  this._init(options)
}

//@ts-expect-error Vue has function type  原型上加 _init 方法 (new Vue 的时候发生什么就看这里)
initMixin(Vue)
//@ts-expect-error Vue has function type  原型上加 $data (一个getter 代理的 this._data), $props(this._props ) , $set , $delete , $watch
stateMixin(Vue)
//@ts-expect-error Vue has function type  原型上加 $on , $emit , $once , $off
eventsMixin(Vue)
//@ts-expect-error Vue has function type  原型上加 _update , $forceUpdate , $destroy
lifecycleMixin(Vue)
//@ts-expect-error Vue has function type  原型上加 _render , $nextTick  // _render 中其实执行的是 render.call(vm._renderProxy, vm.$createElement)
renderMixin(Vue)

export default Vue as unknown as GlobalAPI
