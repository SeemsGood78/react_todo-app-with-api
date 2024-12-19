/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, { useEffect, useRef, useState } from 'react';
import { UserWarning } from './UserWarning';
import {
  getTodos,
  USER_ID,
  deleteTodo,
  addTodo,
  completeTodo,
  renameTodo,
} from './api/todos';
import { Todo } from './types/Todo';
import classNames from 'classnames';

enum Filter {
  All = 'all',
  Active = 'active',
  Completed = 'completed',
}

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState(Filter.All);
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingTodoId, setLoadingTodoId] = useState<number | null>(null);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const activeCount = todos.filter(todo => todo.completed === false);
  const completedTodos = todos.filter(todo => todo.completed);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getTodos()
      .then(setTodos)
      .catch(() => setErrorMessage('Unable to load todos'));
  }, []);

  useEffect(() => {
    if (!isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  function filterTodos() {
    switch (filter) {
      case Filter.Active:
        return todos.filter(todo => !todo.completed);
      case Filter.Completed:
        return todos.filter(todo => todo.completed);
      case Filter.All:
      default:
        return todos;
    }
  }

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = newTodoTitle.trim();

    if (!trimmedTitle) {
      setErrorMessage('Title should not be empty');

      return;
    }

    const newTodo: Omit<Todo, 'id'> = {
      title: trimmedTitle,
      userId: USER_ID,
      completed: false,
    };

    setTempTodo({ ...newTodo, id: 0 });

    setIsAdding(true);
    addTodo(newTodo)
      .then(todoItem => {
        setTodos(prevTodos => [...prevTodos, todoItem]);
        setNewTodoTitle('');
      })
      .catch(() => {
        setErrorMessage('Unable to add a todo');
      })
      .finally(() => {
        setTempTodo(null);
        setIsAdding(false);
        inputRef.current?.focus();
      });
  };

  const handleDeleteCompleted = () => {
    const completedIds = completedTodos.map(todo => todo.id);

    Promise.allSettled(completedIds.map(id => deleteTodo(id)))
      .then(results => {
        const failedDeletions = completedIds.filter(
          (_, index) => results[index].status === 'rejected',
        );

        setTodos(currentTodos =>
          currentTodos.filter(
            todo =>
              !completedIds.includes(todo.id) ||
              failedDeletions.includes(todo.id),
          ),
        );

        if (failedDeletions.length > 0) {
          setErrorMessage('Unable to delete a todo');
        }
      })
      .catch(() => {
        setErrorMessage('Unable to delete a todo');
      })
      .finally(() => inputRef.current?.focus());
  };

  const handleDelete = (todoId: number) => {
    setLoadingTodoId(todoId);
    deleteTodo(todoId)
      .then(() => {
        setTodos(currentTodos =>
          currentTodos.filter(todo => todo.id !== todoId),
        );
      })
      .catch(() => {
        setErrorMessage('Unable to delete a todo');
      })
      .finally(() => {
        inputRef.current?.focus();
        setLoadingTodoId(null);
      });
  };

  const handleComplete = (todoId: number) => {
    const currentTodo = todos.find(todo => todo.id === todoId);

    if (!currentTodo) {
      return;
    }

    const newCompletionState = !currentTodo.completed;

    setLoadingTodoId(todoId);
    completeTodo(todoId, newCompletionState)
      .then(() => {
        setTodos(prevTodos =>
          prevTodos.map(todo =>
            todo.id === todoId
              ? { ...todo, completed: newCompletionState }
              : todo,
          ),
        );
      })
      .catch(() => {
        setErrorMessage('Unable to update a todo');
      })
      .finally(() => {
        setLoadingTodoId(null);
      });
  };

  const handleCompleteAll = () => {
    const allCompleted = todos.every(todo => todo.completed);
    const newCompletionState = !allCompleted;

    const todosToUpdate = newCompletionState
      ? todos.filter(todo => !todo.completed)
      : todos;

    const todoIdsToUpdate = todosToUpdate.map(todo => todo.id);

    Promise.allSettled(
      todoIdsToUpdate.map(id => completeTodo(id, newCompletionState)),
    )
      .then(results => {
        const failedUpdates = todoIdsToUpdate.filter(
          (_, index) => results[index].status === 'rejected',
        );

        setTodos(currentTodos =>
          currentTodos.map(todo =>
            todoIdsToUpdate.includes(todo.id)
              ? { ...todo, completed: newCompletionState }
              : todo,
          ),
        );

        if (failedUpdates.length > 0) {
          setErrorMessage('Unable to update todos');
        }
      })
      .catch(() => {
        setErrorMessage('Unable to update todos');
      });
  };

  const filteredTodos = filterTodos();

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 3000);

      return () => clearTimeout(timer);
    }

    return;
  }, [errorMessage]);

  if (!USER_ID) {
    return <UserWarning />;
  }

  const handleSaveEdit = (todoId: number) => {
    const trimmedTitle = editingTitle.trim();

    const currentTodo = todos.find(todo => todo.id === todoId);

    if (currentTodo && trimmedTitle === currentTodo.title) {
      setEditingTodoId(null);

      return;
    }

    if (trimmedTitle === '') {
      handleDelete(todoId);
    } else {
      setLoadingTodoId(todoId);

      renameTodo(todoId, trimmedTitle)
        .then(() => {
          setTodos(prevTodos =>
            prevTodos.map(todo =>
              todo.id === todoId ? { ...todo, title: trimmedTitle } : todo,
            ),
          );
          setEditingTodoId(null);
        })
        .catch(() => {
          setErrorMessage('Unable to update a todo');
        })
        .finally(() => {
          setLoadingTodoId(null);
        });
    }
  };

  const handleCancelEdit = () => {
    setEditingTodoId(null);
    setEditingTitle('');
  };

  const handleEditTodo = (todoId: number, title: string) => {
    setEditingTodoId(todoId);
    setEditingTitle(title);
  };

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {/* this button should have `active` class only if all todos are completed */}
          {todos.length > 0 && (
            <button
              onClick={handleCompleteAll}
              type="button"
              className={classNames(
                'todoapp__toggle-all',
                activeCount.length === 0 && 'active',
              )}
              data-cy="ToggleAllButton"
            />
          )}

          {/* Add a todo on form submit */}
          <form onSubmit={handleAddTodo}>
            <input
              ref={inputRef}
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              value={newTodoTitle}
              onChange={e => setNewTodoTitle(e.target.value)}
              disabled={isAdding}
              autoFocus
            />
          </form>
        </header>

        <section className="todoapp__main" data-cy="TodoList">
          {filteredTodos.map(todo => (
            <div
              data-cy="Todo"
              className={classNames('todo', todo.completed && 'completed')}
              key={todo.id}
            >
              <label
                className="todo__status-label"
                onClick={() => handleComplete(todo.id)}
              >
                <input
                  data-cy="TodoStatus"
                  type="checkbox"
                  className="todo__status"
                  checked={todo.completed}
                />
              </label>
              {editingTodoId === todo.id ? (
                <>
                  <form onSubmit={e => e.preventDefault()}>
                    <input
                      data-cy="TodoTitleField"
                      type="text"
                      className="todo__title-field"
                      placeholder="Empty todo will be deleted"
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onBlur={() => handleSaveEdit(todo.id)}
                      onKeyUp={e => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(todo.id);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      autoFocus
                    />
                  </form>
                  <div
                    data-cy="TodoLoader"
                    className={classNames(
                      'modal',
                      'overlay',
                      loadingTodoId === todo.id && 'is-active',
                    )}
                  >
                    <div
                      className="modal-background
                     has-background-white-ter"
                    />
                    <div className="loader" />
                  </div>
                </>
              ) : (
                <>
                  <span
                    data-cy="TodoTitle"
                    className="todo__title"
                    onDoubleClick={() => handleEditTodo(todo.id, todo.title)}
                  >
                    {todo.title}
                  </span>

                  {/* Remove button appears only on hover */}
                  <button
                    type="button"
                    className="todo__remove"
                    data-cy="TodoDelete"
                    onClick={() => handleDelete(todo.id)}
                  >
                    ×
                  </button>

                  {/* overlay will cover the todo while it is being deleted or updated */}
                  <div
                    data-cy="TodoLoader"
                    className={classNames(
                      'modal',
                      'overlay',
                      loadingTodoId === todo.id && 'is-active',
                    )}
                  >
                    <div
                      className="modal-background
                    has-background-white-ter"
                    />
                    <div className="loader" />
                  </div>
                </>
              )}
            </div>
          ))}
          {tempTodo && (
            <div data-cy="Todo" className="todo">
              <label className="todo__status-label">
                <input type="checkbox" className="todo__status" disabled />
              </label>
              <span data-cy="TodoTitle" className="todo__title">
                {tempTodo.title}
              </span>
              <div data-cy="TodoLoader" className={'modal overlay is-active'}>
                <div className="modal-background has-background-white-ter" />
                <div className="loader" />
              </div>
            </div>
          )}
        </section>

        {/* Hide the footer if there are no todos */}
        {todos.length > 0 && (
          <footer className="todoapp__footer" data-cy="Footer">
            <span className="todo-count" data-cy="TodosCounter">
              {activeCount.length} items left
            </span>

            {/* Active link should have the 'selected' class */}
            <nav className="filter" data-cy="Filter">
              <a
                href="#/"
                className={classNames(
                  'filter__link',
                  filter === Filter.All && 'selected',
                )}
                data-cy="FilterLinkAll"
                onClick={() => setFilter(Filter.All)}
              >
                All
              </a>

              <a
                href="#/active"
                className={
                  filter === Filter.Active
                    ? 'filter__link selected'
                    : 'filter__link'
                }
                data-cy="FilterLinkActive"
                onClick={() => setFilter(Filter.Active)}
              >
                Active
              </a>

              <a
                href="#/completed"
                className={
                  filter === 'completed'
                    ? 'filter__link selected'
                    : 'filter__link'
                }
                data-cy="FilterLinkCompleted"
                onClick={() => setFilter(Filter.Completed)}
              >
                Completed
              </a>
            </nav>

            {/* this button should be disabled if there are no completed todos */}
            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              onClick={() => handleDeleteCompleted()}
              disabled={!completedTodos.length}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      <div
        data-cy="ErrorNotification"
        className={
          errorMessage
            ? 'notification is-danger is-light has-text-weight-normal'
            : 'hidden'
        }
      >
        <button data-cy="HideErrorButton" type="button" className="delete" />
        {errorMessage}
      </div>
    </div>
  );
};
