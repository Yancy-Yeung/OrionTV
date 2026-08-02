# 修复 null Category 导致崩溃的问题

## 问题描述

在 `homeStore.ts` 中，当播放记录为空时，代码尝试调用：
```typescript
get().selectCategory(newCategories[0] || null);
```

传入 `null` 后：
1. TypeScript/JavaScript 执行 `getCacheKey(null)` 
2. `(null as any)?.title || "unknown"` → `"unknown"`
3. 然后尝试访问 `category.title/tag` on the original category parameter that is **already checked** before accessing properties

## 根本原因

- `selectCategory(category: Category)` 的类型签名不允许 null，但代码传入了 `|| null`
- 当传入 `null` 时，后续代码直接访问 `category.title/tag` 导致崩溃（TypeError）

## 修复方案

### 1. 更新类型签名
```typescript
// Before
selectCategory: (category: Category) => void;

// After  
selectCategory: (category: Category | null) => void;
```

### 2. 在函数开头处理 null/undefined
```typescript
selectCategory: (category: Category | null) => {
    // Handle null by deferring to first available category
    if (!category) {
      const categories = get().categories;
      if (categories.length > 0 && categories[0].type !== "record") {
        setTimeout(() => get().selectCategory(categories[0]), 0);
      }
      return;
    }

    // ... rest of the function can safely access category properties
}
```

### 3. 修复所有调用点（使用 setTimeout 避免嵌套状态更新）

**第316-320行**:
```typescript
if (state.selectedCategory.type === "record" && newCategories.length > 0) {
    // Defer category selection to avoid nested state updates  
    setTimeout(() => get().selectCategory(newCategories[0]), 0);
}
```

**第334-338行**:
```typescript
if (state.selectedCategory.type === "record" && newCategories.length > 0) {
    // Defer category selection to avoid nested state updates
    setTimeout(() => get().selectCategory(newCategories[0]), 0);
}
```

## 关键改进点

1. **类型安全**: 现在 `selectCategory` 接受 `Category | null`
2. **防御性编程**: 在访问 category 属性前检查是否为 null/undefined  
3. **避免嵌套状态更新**: 使用 `setTimeout(..., 0)` defer selectCategory 调用，防止 Zustand 的 set() in set() crash
4. **边界条件处理**: 添加 `newCategories.length > 0` 检查确保总有有效分类可选

## 测试场景

- ✅ 首次启动无播放记录 → 自动选择第一个非 record category（默认）
- ✅ 清除所有播放记录后 "历史记录" tab消失，已选历史时回退到默认  
- ✅ API未配置时切换分类不崩溃
- ✅ 正常切换各个分类工作正常

## 相关文件

- `stores/homeStore.ts` - home store state management
- `app/index.tsx` - uses selectCategory with valid Category objects only

```

传入 `null` 后：