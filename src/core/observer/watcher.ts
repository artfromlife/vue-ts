import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop,
  isFunction
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget, DepTarget } from './dep'
import { DebuggerEvent, DebuggerOptions } from 'v3/debug'

import type { SimpleSet } from '../util/index'
import type { Component } from 'types/component'
import { activeEffectScope, recordEffectScope } from 'v3/reactivity/effectScope'

let uid = 0

/**
 * @internal
 */
export interface WatcherOptions extends DebuggerOptions {
  deep?: boolean
  user?: boolean
  lazy?: boolean
  sync?: boolean
  before?: Function
}

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 * @internal
 */
export default class Watcher implements DepTarget {
  vm?: Component | null
  expression: string
  cb: Function
  id: number
  deep: boolean
  user: boolean
  lazy: boolean
  sync: boolean
  dirty: boolean
  active: boolean
  deps: Array<Dep>
  newDeps: Array<Dep>
  depIds: SimpleSet
  newDepIds: SimpleSet
  before?: Function
  onStop?: Function
  noRecurse?: boolean
  getter: Function
  value: any
  post: boolean

  // dev only
  onTrack?: ((event: DebuggerEvent) => void) | undefined
  onTrigger?: ((event: DebuggerEvent) => void) | undefined

  constructor(
    vm: Component | null,
    expOrFn: string | (() => any),
    cb: Function,
    options?: WatcherOptions | null,
    isRenderWatcher?: boolean
  ) {
    recordEffectScope(this, activeEffectScope || (vm ? vm._scope : undefined))
    if ((this.vm = vm)) {
      if (isRenderWatcher) {
        vm._watcher = this
      }
    }
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
      if (__DEV__) {
        this.onTrack = options.onTrack
        this.onTrigger = options.onTrigger
      }
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true // 不知道干啥用的
    this.post = false // 不知道干啥用的
    this.dirty = this.lazy // for lazy watchers // 懒执行就是 dirty ?
    this.deps = []   // 为什么会有2个 dep 的数组 ？ ， 每次更新都会重新进行依赖收集
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = __DEV__ ? expOrFn.toString() : '' // 生产环境没有 expression , 为啥， 应该是为了报错提示吧
    // parse expression for getter
    if (isFunction(expOrFn)) {
                            // renderWatcher 也是function
      this.getter = expOrFn // 执行getter不会触发依赖收集， get（）里面包的 getter 才会进行依赖收集 (就是computed 函数)
    } else {
      this.getter = parsePath(expOrFn) // 其实就是深度访问 a.b.c.d.e.f
      if (!this.getter) {
        this.getter = noop  // getter 不存在， 你要watch 的东西不存在， 但是路径上能访问到的还是进行了依赖收集
        __DEV__ &&
          warn(
            `Failed watching path: "${expOrFn}" ` +
              'Watcher only accepts simple dot-delimited paths. ' +
              'For full control, use a function instead.',
            vm
          )
      }
    }
    this.value = this.lazy ? undefined : this.get() // 如果不是 懒执行， 这时候就会执行 get() 进行依赖收集
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get() {
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
    } catch (e: any) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // deep 深度的抵赖收集， 我现在简单的理解为 JSON.stringify(value), 就是把 value 的所有值都访问一边， 触发依赖收集
      if (this.deep) { // 依赖收集是双向的， 为了 tearDown watcher 的时候用的
        traverse(value)
      }
      popTarget()
      // 每一次的 update 都会执行 get 重新进行依赖收集, 目的就是由于闭包产生的 dep 把不用的 watcher 从 subs 中拿掉， 减少内存泄露
      // 每一次的 依赖收集都要把 watcher 从不要的 dep 中清除掉

      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep(dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id) // watcher 反向收集 Dep
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) { // depIds 里面没有 这个 dep , 说明 watcher 还没有被添加到 dep.sub 中
        dep.addSub(this) // 双向收集！
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps() {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      // 通知不用的 dep ,把自己从 subs 中移除
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    // 新收集的 清空 depsId deps, 把 newDepIds , newDeps 替换过去
    let tmp: any = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update() {
    /* istanbul ignore else */
    if (this.lazy) { // lazy 的话就压根不执行 , 刚进来 dirty === lazy
      this.dirty = true // 我 dirty 了, 再次访问 computedKey的时候才会进行 重新计算
    } else if (this.sync) { // sync 就立马执行回调, 渲染watcher 绝对不会这样， 但是用户watcher , computed 由于用户不能传选项， 所以只有用户 watcher 会走这里
      this.run()
    } else {
      // 异步的更新！！！, watcher 不能频繁的被更新, 应当放到一个队列里等着,在一个tick里, 你的watcher 可能想执行 10000次， 但是只会执行最后一次进来的
      queueWatcher(this) // 最后还是会触发 run 方法
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run() { // 同步的 watcher { sync: true }, 说 update 就直接 update 了
    if (this.active) { // 好像都是active watcher, 执行的 tearDown 之后就不是 active 了
      const value = this.get() // update, get用于获取当前值，传入callback 作为 newValue, 再次触发依赖收集,
      // 好比你在 watch  a.b.c.d.e 这样一个深度嵌套的对象,  整个路径上的 闭包 dep 以及 对象的childOb.dep 都会收集到这个 watcher, 同样这些 dep 也会被 watcher 收集起来
      // 突然 这个路径上只剩下 a.b 了 c , d , e 都被删除了， 触发了update, 再次进行(dep 的反向收集)依赖收集, 这次发现收集的deps[] 和 之前收集的 deps[] 不一样了
      // 有些 dep 这次没收集起来， 你要通知他们 把自己从他们的 subs 中丢掉
      if ( // new old 不一样 || new value 是对象 || deep 才会执行回调
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(
            this.cb,
            this.vm,
            [value, oldValue],
            this.vm,
            info
          )
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate() {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend() {
    // 其实就是 dep.depend(), 每个dep 添加 watcher
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown() {
    if (this.vm && !this.vm._isBeingDestroyed) {
      remove(this.vm._scope.effects, this)
    }
    if (this.active) {
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
      if (this.onStop) {
        this.onStop()
      }
    }
  }
}
