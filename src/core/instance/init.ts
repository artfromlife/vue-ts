// @ts-ignore
// @ts-ignore

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'
import type { Component } from 'types/component'
import type { InternalComponentOptions } from 'types/options'
import { EffectScope } from 'v3/reactivity/effectScope'

let uid = 0

export function initMixin(Vue: typeof Component) {
  Vue.prototype._init = function (options?: Record<string, any>) { // new 一个Vue 发生了啥
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (__DEV__ && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to mark this as a Vue instance without having to do instanceof
    // check
    vm._isVue = true  // 1.给实例加标记 _isVue
    // avoid instances from being observed
    vm.__v_skip = true  // 2.给实例加标记 _isVue__v_skip
    // effect scope
    vm._scope = new EffectScope(true /* detached */) // 3.给实例加 _scope
    // merge options
    if (options && options._isComponent) { // 最开始是不会有options里面有 _isComponent
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options as any)
    } else { // 4. 初次的 new 会进这里吧 ， 给实例加 $options，合并选项， 明明有更好理解的方式来写这个东西，呵呵
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor as any),
        options || {},
        vm
      )
    }
    // 就是一个选项合并（建议之后再看）
    /* istanbul ignore else */
    if (__DEV__) {
      initProxy(vm)
    } else {
      vm._renderProxy = vm // 5. 搞了一个代理指向自己。。
    }
    // expose real self
    vm._self = vm  // 6.又搞了个东西指向自己
    initLifecycle(vm) // 7. 通过 $options 构建$parent, $children
    initEvents(vm) // 8. 可能和父组件，监听子组件事件有关系 _events
    initRender(vm) // 9. 这点有点复杂，不是很懂 //  vm._c  , vm.$createdElement
    callHook(vm, 'beforeCreate', undefined, false /* setContext */) // callHook 执行的是 Hooks 数组
    initInjections(vm) // resolve injections before data/props
    initState(vm) // 10. 这就是先 让 数据变成 reactive
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (__DEV__ && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el)  // 这个el 只有跟组件才有, 那么子组件怎么 mount 呢
      // 开始挂载了
      vm.$mount(vm.$options.el)
    }
}

export function initInternalComponent(
  vm: Component,
  options: InternalComponentOptions
) {
  const opts = (vm.$options = Object.create((vm.constructor as any).options))
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions!
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions(Ctor: typeof Component) {
  // Ctor 实例的构造函数
  let options = Ctor.options
  if (Ctor.super) { // Vue.extend()搞出来的
    const superOptions = resolveConstructorOptions(Ctor.super) // 父父类的构造函数
    const cachedSuperOptions = Ctor.superOptions // 父父类的选项
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  // 返回弗雷及其祖先？
  return options
}

function resolveModifiedOptions(
  Ctor: typeof Component
): Record<string, any> | null {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
