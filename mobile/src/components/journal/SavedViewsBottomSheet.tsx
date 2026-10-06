import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { ChevronRight, Trash2, Edit2, Save, X } from 'lucide-react-native';
import { BottomSheet, Button, Input, Chip } from '../common';
import { useTheme } from '../../hooks/useTheme';
import {
  SavedJournalView,
  loadSavedViews,
  persistNewView,
  persistRenameView,
  persistDeleteView,
  viewsForAccount,
} from '../../utils/savedJournalViews';
import { JournalFilterState, getActiveFilterChips } from '../../utils/journalFilters';

interface SavedViewsBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  currentFilters: JournalFilterState;
  currentQuery: string;
  accountId: string;
  onLoadView: (filters: JournalFilterState) => void;
}

interface UIState {
  views: SavedJournalView[];
  loading: boolean;
  editingId: string | null;
  editingName: string;
  newViewName: string;
  creating: boolean;
  error: string | null;
  success: string | null;
}

export function SavedViewsBottomSheet({
  visible,
  onClose,
  currentFilters,
  currentQuery,
  accountId,
  onLoadView,
}: SavedViewsBottomSheetProps) {
  const { theme } = useTheme();

  const [state, setState] = useState<UIState>({
    views: [],
    loading: true,
    editingId: null,
    editingName: '',
    newViewName: '',
    creating: false,
    error: null,
    success: null,
  });

  // Load views when sheet opens
  React.useEffect(() => {
    if (visible) {
      setState((prev) => ({ ...prev, loading: true, error: null, success: null }));
      loadSavedViews()
        .then((views) => {
          setState((prev) => ({ ...prev, views, loading: false }));
        })
        .catch((err) => {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: 'Failed to load saved views.',
          }));
        });
    }
  }, [visible]);

  // Filter views to current account
  const scopedViews = useMemo(() => viewsForAccount(state.views, accountId), [state.views, accountId]);

  // Get summary chips for current filters
  const filterChips = useMemo(() => getActiveFilterChips(currentFilters, currentQuery), [currentFilters, currentQuery]);

  // Handle creating a new view
  const handleCreateView = async () => {
    const trimmed = state.newViewName.trim();
    if (!trimmed) {
      setState((prev) => ({ ...prev, error: 'Please enter a view name.' }));
      return;
    }

    setState((prev) => ({ ...prev, creating: true, error: null }));

    try {
      const result = await persistNewView(state.views, {
        name: trimmed,
        filters: currentFilters,
        accountId,
      });

      if (result.error) {
        setState((prev) => ({
          ...prev,
          creating: false,
          error: result.error,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          views: result.views,
          newViewName: '',
          creating: false,
          success: `Saved view "${result.view?.name || trimmed}".`,
        }));
        // Clear success message after 2 seconds
        setTimeout(() => {
          setState((prev) => ({ ...prev, success: null }));
        }, 2000);
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        creating: false,
        error: 'Failed to create view.',
      }));
    }
  };

  // Handle loading a view
  const handleLoadView = (view: SavedJournalView) => {
    onLoadView(view.filters);
    setState((prev) => ({
      ...prev,
      success: `Loaded "${view.name}".`,
    }));
    setTimeout(() => {
      setState((prev) => ({ ...prev, success: null }));
      onClose();
    }, 1000);
  };

  // Handle start rename
  const handleStartRename = (view: SavedJournalView) => {
    setState((prev) => ({
      ...prev,
      editingId: view.id,
      editingName: view.name,
      error: null,
    }));
  };

  // Handle save rename
  const handleSaveRename = async () => {
    if (!state.editingId) return;

    const trimmed = state.editingName.trim();
    if (!trimmed) {
      setState((prev) => ({ ...prev, error: 'Name cannot be empty.' }));
      return;
    }

    try {
      const result = await persistRenameView(state.views, state.editingId, trimmed);

      if (result.error) {
        setState((prev) => ({
          ...prev,
          error: result.error,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          views: result.views,
          editingId: null,
          editingName: '',
          success: `Renamed to "${trimmed}".`,
        }));
        setTimeout(() => {
          setState((prev) => ({ ...prev, success: null }));
        }, 2000);
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to rename view.',
      }));
    }
  };

  // Handle delete
  const handleDeleteView = (view: SavedJournalView) => {
    Alert.alert('Delete View', `Remove "${view.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const newViews = await persistDeleteView(state.views, view.id);
            setState((prev) => ({
              ...prev,
              views: newViews,
              success: 'View deleted.',
            }));
            setTimeout(() => {
              setState((prev) => ({ ...prev, success: null }));
            }, 2000);
          } catch (err) {
            setState((prev) => ({
              ...prev,
              error: 'Failed to delete view.',
            }));
          }
        },
      },
    ]);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Saved Views">
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Error Message */}
        {state.error && (
          <View style={[styles.message, { backgroundColor: theme.colors.loss + '20' }]}>
            <Text style={[styles.messageText, { color: theme.colors.loss }]}>{state.error}</Text>
          </View>
        )}

        {/* Success Message */}
        {state.success && (
          <View style={[styles.message, { backgroundColor: theme.colors.win + '20' }]}>
            <Text style={[styles.messageText, { color: theme.colors.win }]}>{state.success}</Text>
          </View>
        )}

        {/* Create New View Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
            Save Current View
          </Text>
          <View style={styles.createForm}>
            <Input
              placeholder="e.g. London Breakouts"
              value={state.newViewName}
              onChangeText={(text) =>
                setState((prev) => ({ ...prev, newViewName: text }))
              }
              editable={!state.creating}
              style={{ flex: 1 }}
            />
            <Button
              title="Save"
              onPress={handleCreateView}
              disabled={!state.newViewName.trim() || state.creating}
              loading={state.creating}
              style={{ marginLeft: 8 }}
            />
          </View>

          {/* Show current filter summary */}
          {filterChips.length > 0 && (
            <View style={styles.filterSummary}>
              <Text style={[styles.filterLabel, { color: theme.colors.textMuted }]}>
                Current Filters:
              </Text>
              <View style={styles.chipContainer}>
                {filterChips.map((chip) => (
                  <Chip
                    key={chip.id}
                    label={chip.label}
                    onPress={() => {}}
                    small
                    disabled
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Saved Views List Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.textMuted },
            ]}
          >
            Saved Views · {scopedViews.length}
          </Text>

          {state.loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
          ) : scopedViews.length === 0 ? (
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.textFaint },
              ]}
            >
              No saved views yet. Save the current view above to get started.
            </Text>
          ) : (
            <View style={styles.viewsList}>
              {scopedViews.map((view) => (
                <View
                  key={view.id}
                  style={[
                    styles.viewItem,
                    { borderBottomColor: theme.colors.border },
                  ]}
                >
                  {state.editingId === view.id ? (
                    // Rename Mode
                    <View style={styles.renameForm}>
                      <Input
                        value={state.editingName}
                        onChangeText={(text) =>
                          setState((prev) => ({
                            ...prev,
                            editingName: text,
                          }))
                        }
                        style={{ flex: 1 }}
                      />
                      <TouchableOpacity
                        style={[
                          styles.iconButton,
                          { backgroundColor: theme.colors.bgElevated },
                        ]}
                        onPress={handleSaveRename}
                      >
                        <Save size={16} color={theme.colors.accent} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.iconButton,
                          { backgroundColor: theme.colors.bgElevated },
                        ]}
                        onPress={() =>
                          setState((prev) => ({
                            ...prev,
                            editingId: null,
                            editingName: '',
                            error: null,
                          }))
                        }
                      >
                        <X size={16} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    // View Mode
                    <View style={styles.viewContent}>
                      <TouchableOpacity
                        style={styles.viewMain}
                        onPress={() => handleLoadView(view)}
                      >
                        <Text
                          style={[
                            styles.viewName,
                            { color: theme.colors.text },
                          ]}
                        >
                          {view.name}
                        </Text>
                        <ChevronRight
                          size={16}
                          color={theme.colors.textMuted}
                        />
                      </TouchableOpacity>

                      {/* Actions */}
                      <View style={styles.actions}>
                        <TouchableOpacity
                          style={[
                            styles.actionButton,
                            {
                              backgroundColor: theme.colors.bgElevated,
                            },
                          ]}
                          onPress={() => handleStartRename(view)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Edit2 size={14} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.actionButton,
                            {
                              backgroundColor: theme.colors.bgElevated,
                            },
                          ]}
                          onPress={() => handleDeleteView(view)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={14} color={theme.colors.loss} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
  },
  message: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  createForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterSummary: {
    marginTop: 12,
  },
  filterLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  loadingContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  viewsList: {
    gap: 0,
  },
  viewItem: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
  },
  viewContent: {
    flex: 1,
  },
  viewMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  viewName: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
