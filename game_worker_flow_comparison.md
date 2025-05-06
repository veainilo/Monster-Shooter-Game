# 游戏 Worker 版本流程对比

本文档比较了游戏的两个版本的流程时序图：原始版本和使用 Web Worker 的版本。

## 原始版本流程

在原始版本中，所有游戏逻辑（包括碰撞检测）都在主线程中执行。

```mermaid
sequenceDiagram
    participant Main as 主线程
    participant RAF as requestAnimationFrame
    
    Main->>RAF: 请求下一帧
    RAF-->>Main: 触发下一帧回调
    
    Note over Main: 游戏循环开始
    
    Main->>Main: 更新玩家位置
    Main->>Main: 更新怪物位置
    Main->>Main: 更新子弹位置
    Main->>Main: 生成新怪物
    
    Note over Main: 碰撞检测开始
    Main->>Main: 检测玩家-怪物碰撞
    Main->>Main: 检测怪物-怪物碰撞
    Main->>Main: 检测子弹-怪物碰撞
    Main->>Main: 检测子弹-玩家碰撞
    Note over Main: 碰撞检测结束
    
    Main->>Main: 应用碰撞结果
    Main->>Main: 清理失活实体
    
    Main->>Main: 渲染游戏
    Main->>Main: 更新UI
    
    Note over Main: 游戏循环结束
    
    Main->>RAF: 请求下一帧
```

## Web Worker 版本流程

在 Web Worker 版本中，碰撞检测被移到了 Worker 线程中执行，主线程负责游戏逻辑和渲染。

### 第一版 Worker 实现（主线程等待 Worker 结果）

```mermaid
sequenceDiagram
    participant Main as 主线程
    participant Worker as Worker线程
    participant RAF as requestAnimationFrame
    
    Main->>RAF: 请求下一帧
    RAF-->>Main: 触发下一帧回调
    
    Note over Main: 游戏循环开始
    
    Main->>Main: 更新玩家位置
    Main->>Main: 更新怪物位置
    Main->>Main: 更新子弹位置
    Main->>Main: 生成新怪物
    
    Note over Main: 准备碰撞数据
    Main->>Worker: 发送碰撞数据 (postMessage)
    
    Note over Worker: 碰撞检测开始
    Worker->>Worker: 检测玩家-怪物碰撞
    Worker->>Worker: 检测怪物-怪物碰撞
    Worker->>Worker: 检测子弹-怪物碰撞
    Worker->>Worker: 检测子弹-玩家碰撞
    Note over Worker: 碰撞检测结束
    
    Worker-->>Main: 返回碰撞结果 (postMessage)
    
    Main->>Main: 应用碰撞结果
    Main->>Main: 清理失活实体
    
    Main->>Main: 渲染游戏
    Main->>Main: 更新UI
    
    Note over Main: 游戏循环结束
    
    Main->>RAF: 请求下一帧
```

### 最终优化版 Worker 实现（主线程不等待 Worker 结果）

```mermaid
sequenceDiagram
    participant Main as 主线程
    participant Worker as Worker线程
    participant RAF as requestAnimationFrame
    
    Main->>RAF: 请求下一帧(第1帧)
    RAF-->>Main: 触发第1帧回调
    
    Note over Main: 第1帧游戏循环开始
    
    Main->>Main: 更新玩家位置
    Main->>Main: 更新怪物位置
    Main->>Main: 更新子弹位置
    Main->>Main: 生成新怪物
    
    Note over Main: 准备碰撞数据
    Main->>Worker: 发送碰撞数据 (使用 transferable objects)
    Note over Main: 标记 Worker 为忙碌状态
    
    Main->>Main: 继续其他游戏逻辑
    Main->>Main: 渲染游戏
    Main->>Main: 更新UI
    
    Note over Main: 第1帧游戏循环结束
    
    Main->>RAF: 请求下一帧(第2帧)
    
    Note over Worker: 碰撞检测开始
    Worker->>Worker: 检测玩家-怪物碰撞
    Worker->>Worker: 检测怪物-怪物碰撞
    Worker->>Worker: 检测子弹-怪物碰撞
    Worker->>Worker: 检测子弹-玩家碰撞
    Note over Worker: 碰撞检测结束
    
    RAF-->>Main: 触发第2帧回调
    
    Note over Main: 第2帧游戏循环开始
    
    Main->>Main: 更新玩家位置
    Main->>Main: 更新怪物位置
    Main->>Main: 更新子弹位置
    Main->>Main: 生成新怪物
    
    Worker-->>Main: 返回碰撞结果 (使用 transferable objects)
    
    Main->>Main: 应用碰撞结果
    Note over Main: 标记 Worker 为空闲状态
    
    Main->>Main: 继续其他游戏逻辑
    Main->>Main: 渲染游戏
    Main->>Main: 更新UI
    
    Note over Main: 第2帧游戏循环结束
    
    Main->>RAF: 请求下一帧(第3帧)
```

## 两个版本的主要区别

1. **原始版本**：
   - 所有处理都在主线程中进行
   - 碰撞检测可能导致主线程阻塞，影响帧率
   - 实现简单，无需处理线程间通信

2. **第一版 Worker 实现**：
   - 碰撞检测在 Worker 线程中进行
   - 主线程等待 Worker 返回结果，仍可能导致阻塞
   - 减轻了主线程负担，但通信开销可能抵消部分性能提升

3. **最终优化版 Worker 实现**：
   - 碰撞检测在 Worker 线程中进行
   - 主线程不等待 Worker 返回结果，继续处理下一帧
   - Worker 结果在下一帧或之后的帧中应用
   - 使用 transferable objects 优化数据传输
   - 主线程完全不阻塞，可以保持高帧率
   - 碰撞结果有一帧的延迟，但在游戏中几乎不可察觉
