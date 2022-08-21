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
    // merge options // 最重要的 $options !!!!
    if (options && options._isComponent) { // vNode.componentOptions =^=
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 就是初始化子组件的 vm.$options 原型是 构造函数的 options ,再往 vm.options 中加点 parent , _parentListeners
      initInternalComponent(vm, options as any)
    } else { // 4. 根组件的选项合并
      vm.$options = mergeOptions(
        // 为什么每次组件的实例化都要执行一次, 是为了什么??
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
  // 为什么原型链的查找更快？子组件的构造函数长什么样子(是通过Vue.extend过来的)
  // 基本上看来每一个的Vue组件类型都会有一个不同的构造函数， 每一种类型的组件都有自己的构造函数
  // 最重要的莫过于 组件构造函数的 options 静态属性了, 因为每一个组件的 $options 都以这个静态属性为原型 (子组件)
  const opts = (vm.$options = Object.create((vm.constructor as any).options))
  // doing this because it's faster than dynamic enumeration.
  // 为什么传进来的子组件的选项中会有 _parentVnode , 是因为父组件一定要先实例化，然后实例化后会自己 $mount -> 创建renderWatcher
  // -> getter __update(vm.render()) -> render的函数的执行会拿到Vnode, 就在这个Vnode获取的过程中, 给这个选项搞了点东西进去
  const parentVnode = options._parentVnode
  // 子组件的options 又多了 parent(这个parent 是父组件的Vnode , 还是组件实例呢， 这个要看 Vnode 是怎么生成的了)
  opts.parent = options.parent
  // 构造函数的option 可能已经和 用户写的组件 option 合并了， 不知道什么时候合并的，应该是创建组件构造函数的时候把组建的选项合并到构造函数的options中去了
  // 为什么不把option 直接放在原型上呢, 为什么要放在构造函数上面 ??? why ??? 再更改 $options 的原型指向 构造函数的 options
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions!
  //
  opts.propsData = vnodeComponentOptions.propsData
  // 通过虚拟NODE 将 父组件的Vnode中的 componentOptions 中的 listeners 搞成了 _parentListeners
  // 以下都是父组件的信息
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
  // 传进来的是根组件的 构造函数
  let options = Ctor.options
  // 看看构造函数是不是 Vue.extend() 的结果
  if (Ctor.super) { // 是的话做一些处理
    const superOptions = resolveConstructorOptions(Ctor.super)
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
